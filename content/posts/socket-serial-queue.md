+++
date = '2026-10-21T00:00:00+09:00'
draft = true
title = '소켓 메시지가 보낸 순서대로 안 찍힌다'
description = '몽글 플레이 화면에서 프론트가 우선순위와 지연 시간으로 소켓 메시지 순서를 다시 매기던 큐를 지우고, 서버가 보낸 순서대로 앞 메시지 처리가 끝나야 다음을 꺼내는 큐로 바꿨다. 둘러보기 목록 연출이 끝날 때까지 큐를 멈추는 게이트를 붙이고, 빠른 이동의 서버 진행 신호는 큐에 넣기 전에 보내 연출과 분리했다.'
tags = ["설계", "상태 관리", "React"]
+++

<!-- 저자 확인 필요:
- 우선순위 정렬과 700ms 간격 큐를 지운 이유는 커밋에 없어 쓰지 않았다.
- 메시지 네 개 예시와 move 추월은 당시 코드를 따라간 예시다(실제로 겪었다는 기록 없음).
- 경력 bullet은 91종 중 50종, 현재 코드는 93종 중 50종.
- 빠른 이동이 중간에 멈추던 장면 묘사가 기억과 맞는지.
- "게이트"가 코드나 커밋에 실제로 있는 이름인지. 없으면 AI가 붙인 이름이라 풀어 쓴 말로 바꿔야 한다.
- `lookAround`를 둘러보기 메시지로, `move`를 이동 메시지로 풀어 썼고 스토어는 `subscribeWithSelector` 링크를 근거로 zustand라고 적었다. 맞는지.
-->

회사에서 개발 중인 서비스인 몽글의 플레이 화면은 서버가 소켓으로 보내는 메시지를 채팅처럼 아래로 쌓아서 보여준다. 장소에 들어가면 장소 설명이 나오고, 그 장소에 있는 오브젝트와 NPC와 몬스터를 보여주는 둘러보기 목록이 종류별 애니메이션으로 한 줄씩 등장한다. 그 사이에도 다른 플레이어의 채팅이나 시스템 메시지는 계속 들어온다.

2025년 6월에 재접속하면 인사말이 제대로 나오지 않는 문제를 고친 적이 있다. 인사말이 장소 이름보다 먼저 나와야 했기 때문에 입장할 때 오는 `join` 메시지를 500ms 늦게 그리게 했다. 그 뒤에는 이 `join` 메시지와 둘러보기, 연계 이벤트가 정해진 순서로 나와야 했다. 그래서 이 메시지들이 올 때까지 기다렸다가 300ms 간격으로 직접 찍게 작업했다. 그러니까 서버가 보낸 메시지를 어떤 순서로 찍을지를 프론트가 시간을 늦춰가며 맞추고 있었던 것이다.

## 처리기 93개 중 50개는 한 줄로 만든다

소켓 메시지는 `type`(채팅은 `chattype`)마다 처리기가 정해져 있다. 처리기는 메시지를 채팅 한 건으로 바꿔 `addChat`으로 스토어에 넣고, 화면은 스토어를 보고 그린다. 지금 처리기는 `type`용 81개와 `chattype`용 12개를 합쳐 93개다.

2025년 9월 중순까지는 처리기마다 `addChat` 호출을 직접 썼다. 아래 부활 카운트 처리기처럼 메시지 필드를 채팅 필드로 하나씩 옮기는 블록이 30개 넘게 반복됐다.

```ts
revivalCount: ({ data, addChat }) => {
    addChat({
        needToDown: data.isTargetMe ?? false,
        key: '플레이어 부활 카운트',
        speaker: data.speaker,
        thumb: data.thumbnail,
        script: data.message,
        title: data.title,
        id: data.id,
    });
},
```

지금은 메시지 필드를 채팅 필드로 옮기는 일은 `createBasicChat` 한 곳에서 하고, 조건만 다른 단순 메시지의 처리기는 `createBasicProcessor`로 만든다.

```ts
function createBasicProcessor(config: BasicProcessorConfig = {}): MessageProcessor {
    return async (args: MessageProcessorArgs) => {
        const { data, addChat, playDataId } = args;
        // ... onlyIfMessage 같은 조건 확인
        try {
            // ...
            await addChat(
                createBasicChat(data, {
                    isTargetMe: isTargetMe || !data.isUser,
                    ...config.overrides,
                }),
                playDataId,
            ); // 스토어에 넣을 때까지 기다렸다가 끝난다
        } catch (error) {
            console.error('[BasicProcessor] Failed:', error);
        }
    };
}

export const typeProcessors: Record<string, MessageProcessor> = {
    // ...
    revivalCount: createBasicProcessor(),
    battle: createBasicProcessor({ overrides: { type: 'battle' } }),
    // ...
};
```

이렇게 한 줄로 만드는 처리기 50개 중 38개는 `createBasicProcessor`를 그대로 쓰고, 나머지 12개는 상점이나 둘러보기처럼 따로 만든 생성 함수를 쓴다.

## 첫 번째: 프론트에서 우선순위로 순서를 다시 매기기

2025년 9월 말에는 거의 모든 처리기를 큐 하나에 넣었다. 큐는 타입마다 매긴 우선순위 숫자가 큰 것부터 꺼내고, 하나를 처리할 때마다 700ms씩 간격을 뒀다. `join`을 500ms 늦게 그리던 처리도 이때 우선순위 10으로 바뀌었다. `error`는 15, `getReward`는 4였고 나머지는 대부분 5였다.

```ts
private sortQueue(): void {
    this.taskQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
            return b.priority - a.priority; // 우선순위가 높은 게 앞으로
        }
        return a.scheduledTime - b.scheduledTime; // 같으면 먼저 온 순서
    });
}

private async processQueue(): Promise<void> {
    // ...
    while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        const now = Date.now();

        if (now < this.nextExecutionTime) {
            const waitTime = this.nextExecutionTime - now;
            await this.wait(waitTime); // 앞 메시지와 700ms 간격을 둔다
        }

        try {
            task.processor();
        } catch (error) {
            // ...
        }

        this.nextExecutionTime = Date.now() + this.DELAY;
        // ...
    }
}
```

`sortQueue`는 메시지가 들어올 때마다 큐에 남은 메시지를 다시 정렬한다. 그래서 메시지가 몰려 들어오면 서버가 보낸 순서와 다르게 찍힐 수 있다. 서버가 아래 메시지 네 개를 10ms 간격으로 보낸 경우를 보자.

```text
보낸 순서: eventComplete -> levelup -> getReward -> lookAround
찍힌 순서: eventComplete(0ms) -> levelup(714ms) -> lookAround(1424ms) -> getReward(2124ms)
```

`eventComplete`는 바로 처리되고, `levelup`은 큐에서 꺼내진 채로 700ms를 기다린다. 그 사이 큐에 들어온 `getReward`(4)와 둘러보기 메시지인 `lookAround`(5)는 다시 정렬된다. 그래서 늦게 온 `lookAround`가 우선순위가 더 높다는 이유로 `getReward`보다 먼저 나온다. 서버가 보낸 순서보다 프론트가 정한 우선순위가 먼저 적용되는 것이다.

이 우선순위 정렬은 2025년 12월에 지웠고, 2026년 2월에는 700ms 간격을 두던 큐도 지웠다.

## 두 번째: 앞 메시지 처리가 끝나야 다음 메시지를 꺼내기

2월에 큐를 지우면서 처리기를 전부 Promise를 돌려주는 async 함수로 바꿨다. 앞에서 본 `createBasicProcessor`도 이때 생겼다. 그런데 메시지를 받는 소켓의 `onmessage`는 처리기를 `await` 없이 바로 불렀다.

이러면 `addChat` 전에 기다리는 일이 있는 처리기는 뒤에 온 메시지의 처리기에게 추월당할 수 있다. 예를 들어 당시 이동 메시지인 `move`의 처리기는 `addChat` 전에 쿼리를 다시 불러오는 걸 기다렸다. 바로 뒤에 온 `lookAround`는 기다릴 게 없으니 먼저 채팅에 들어간다. 서버는 `move -> lookAround` 순서로 보냈는데 화면에는 `lookAround -> move` 순서로 찍히는 것이다.

그래서 이후 서버가 보낸 순서대로 찍히게 하려고 큐를 다시 넣었다. 이번 큐에는 우선순위도 간격도 없고, `onmessage`는 받은 메시지를 큐 뒤에 넣기만 한다. 큐는 메시지를 도착한 순서대로 하나씩 꺼내서 처리기가 끝날 때까지 기다린다. 지금 코드에서 연출과 관련된 줄을 빼면 배열 하나와 플래그 하나로 돈다.

```ts
const processQueue = useCallback(async () => {
    if (isProcessingQueue.current) return; // 이미 돌고 있으면 들어가지 않는다
    // ...
    isProcessingQueue.current = true;

    while (messageQueue.current.length > 0) {
        // ...
        const data = messageQueue.current.shift()!;
        await processMessageRef.current(data); // 처리기가 끝날 때까지 기다린다
        // ...
    }

    isProcessingQueue.current = false;
}, []);
```

`isProcessingQueue` 플래그는 `await`보다 먼저 세운다. 그래서 처리 중에 `processQueue`가 또 불려도 바로 빠져나오고, 새로 들어온 메시지는 이미 돌고 있는 `while`이 이어서 꺼낸다. 플래그를 진입하자마자 거는 건 [중복 실행 방지 락은 진입 시점에 걸자](/posts/faced-three-race-conditions/)에서 쓴 방식과 같다.

큐가 기다리는 건 처리기가 돌려준 Promise 하나뿐이라서 처리기는 스토어에 넣는 일까지 마친 뒤에 끝나야 한다. 단순 메시지 처리기 38개는 `createBasicProcessor`를 그대로 쓰는데, 이 함수는 `addChat`을 `await`한 뒤에 끝난다. 그래서 이 규칙을 한 곳에서 지킬 수 있게 됐다.

## 세 번째: 목록 연출이 끝날 때까지 큐 멈추기

그런데 `await`는 스토어에 들어갈 때까지만 기다린다. `addChat`은 스토어에 채팅을 넣고 바로 끝나고, 둘러보기 목록이 한 줄씩 등장하는 애니메이션은 그 뒤에 화면에서 시작된다. 그러니 목록이 다 나오기 전에 다음 메시지가 그 아래에 찍힐 수 있다.

<!-- 그림: 장소에 들어갔을 때 둘러보기 목록이 종류별로 한 줄씩 등장하는 연출 캡처 -->

그래서 2026년 5월에 메시지 id를 키로 가진 게이트 객체를 채팅 UI 스토어에 두었다. 그릴 항목이 있는 둘러보기 메시지가 오면 처리기를 부르기 전에 그 메시지 id를 게이트에 넣고, 화면에서 그 메시지의 애니메이션이 끝나면 지운다. 게이트에 id가 하나라도 남아 있으면 큐는 다음 메시지를 꺼내지 않는다.

```ts
const processQueue = useCallback(async () => {
    if (isProcessingQueue.current) return;
    if (useChatUIStore.getState().hasPendingLookByTypeAnimations()) return; // 연출 중이면 시작하지 않는다
    isProcessingQueue.current = true;

    while (messageQueue.current.length > 0) {
        // ... 꺼내기 전에도 같은 확인을 한 번 한다
        const data = messageQueue.current.shift()!;
        await processMessageRef.current(data);

        if (useChatUIStore.getState().hasPendingLookByTypeAnimations()) {
            break; // 방금 처리한 메시지가 게이트를 걸었으면 여기서 멈춘다
        }
    }

    isProcessingQueue.current = false;
}, []);
```

채팅 UI 스토어는 zustand의 [`subscribeWithSelector`](https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector)로 만들어져 있어서 게이트 객체만 골라 구독할 수 있다. 그래서 게이트가 비면 이 구독이 멈춘 큐를 다시 돌린다.

큐에 둘러보기 메시지 `L1`과 시스템 메시지 `S`가 순서대로 있다고 하자. `L1`을 처리하면서 게이트가 `{ L1: true }`가 된다. 처리가 끝난 직후의 게이트 확인에서 큐가 멈추기 때문에 `S`는 큐에 남는다. 애니메이션이 다 끝나면 목록을 그리는 렌더러가 게이트에서 `L1`을 지운다. 게이트가 비는 순간 구독이 `processQueue`를 다시 불러서 `S`가 처리된다. 이 흐름은 회귀 테스트로 남겨뒀다.

게이트를 거는 곳은 한 곳이지만 푸는 곳은 여러 곳이다. 애니메이션이 끝났을 때 말고도 이미 한 번 재생한 메시지를 다시 그릴 때나 사용자가 [동작 줄이기](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) 설정을 켜둬서 애니메이션을 재생하지 않을 때도 바로 푼다. 그리고 어느 경로로도 풀리지 않는 경우에는 타이머가 강제로 풀도록 게이트를 걸 때 id마다 5초 타이머를 같이 걸었다.

### 걸자마자 지워지던 게이트

그런데 이동해서 새 장소에 도착할 때는 게이트가 큐를 멈추지 못했다. 이동 도착 메시지의 처리기는 이전 장소 채팅을 비우고 새 목록 하나만 남기는데, 이 작업을 `resetChat()`을 부른 다음 `addChat()`을 부르는 두 단계로 하고 있었다. 문제는 `resetChat`이 같이 부르는 `resetUI`가 게이트 객체까지 비운다는 것이었다. 방금 걸어둔 게이트가 처리 도중에 지워지니 큐는 연출을 기다리지 않고 다음 메시지로 넘어갔다. 두 단계 사이에는 빈 채팅이 잠깐 보이기도 했다.

그래서 채팅 비우기와 넣기를 `set({ chat: [chatWithMeta], ... })` 한 번으로 합친 `replaceChatWith`를 만들었고, 이 함수에서는 `resetUI`를 부르지 않게 했다.

## 네 번째: 서버에 보내는 진행 신호는 큐에 넣기 전에 보내기

플레이어가 `/이동 @장소`를 입력하거나 지도를 클릭하면 빠른 이동으로 목적지까지 여러 장소를 거쳐 간다. 서버는 경유지마다 도착 메시지를 보내고, 프론트가 `moveDisplayDone`을 보내야 다음 경유지 메시지를 보낸다.

처음에는 경유지마다 도착 목록 연출이 끝난 뒤에 이 신호를 보냈다. 그러다 보니 연출이 끝나지 않으면 서버도 다음 경유지 메시지를 보내지 않아서 빠른 이동이 중간에 멈추는 문제가 있었다. 그래서 7월에 신호는 메시지를 받자마자 보내고, 경유지 목록은 게이트를 걸어서 하나씩 보여주게 나눴다. 큐 안에서 보내면 앞 경유지의 게이트가 풀릴 때까지 신호도 같이 기다리기 때문에 신호를 보내는 코드는 큐에 넣기 전으로 뺐다.

```ts
socket.onmessage = (event) => {
    try {
        // ...
        if (isFastMoveHopFrame(data, useFastMoveStore.getState())) {
            socket.send(JSON.stringify({ type: 'moveDisplayDone' })); // 연출을 기다리지 않고 서버를 진행시킨다
            useChatUIStore.getState().setHasSentMoveDisplayDone(true);
        }

        if (data.type === 'moveBlock') {
            useChatUIStore.getState().clearAllLookByTypeAnimationsPending(); // 취소는 게이트를 전부 풀고 들어간다
        }

        messageQueue.current.push(data);
        processQueueRef.current();
    } catch (error) {
        // ...
    }
};
```

이동 취소를 알려주는 `moveBlock`이 게이트 때문에 큐에서 기다리면 취소한 뒤에도 최대 5초 동안 입력이 잠긴다. 그래서 `moveBlock`이 오면 큐에 넣기 전에 게이트를 전부 푼다. 게이트가 걸린 상태에서 새 경유지 메시지가 오는 경우도 테스트로 남겨뒀다. 이 테스트에서는 `moveDisplayDone`이 바로 나가고 채팅에 넣는 일만 게이트가 풀릴 때까지 기다리는지 확인한다.

이 화면에서 기다리는 완료 신호는 세 가지이고, 기다리는 쪽도 각각 다르다.

| 완료 | 신호 | 기다리는 쪽 |
| --- | --- | --- |
| 처리 완료 | 처리기가 돌려준 Promise가 끝남(스토어에 들어감) | 큐의 `await` |
| 연출 완료 | 렌더러가 게이트에서 메시지 id를 지움 | 큐의 게이트 |
| 서버 진행 | `moveDisplayDone` 전송 | 서버 |

## 배운점

처음엔 화면에 찍히는 순서가 틀리면 프론트에서 시간을 늦추거나 우선순위를 매겨서 맞췄다. 지금 프론트 큐는 받은 순서를 바꾸지 않고, 앞 메시지의 처리와 연출이 끝나기를 기다렸다가 다음 메시지로 넘어가기만 한다.

큐가 기다리는 대상이 처리 완료에서 연출 완료로 늘어나자 연출과 상관없는 서버 진행 신호나 이동 취소는 오히려 큐에 넣기 전으로 빼야 했다. 결국 순서는 서버가 보낸 대로 두고, 언제 다음 메시지로 넘어갈지는 화면이 정하게 나누는 게 맞는 것 같다.
