+++
date = '2026-10-23T00:00:00+09:00'
draft = true
title = '백그라운드에서 돌아오면 놓친 메시지는 어디서 받을까?'
description = '몽글 플레이 화면은 앱이 백그라운드로 가고 1분이 지나면 소켓을 끊는데, 다시 연결해도 그 사이에 온 메시지는 소켓으로 다시 오지 않는다. 그래서 다시 연결할 때 화면에 마지막으로 넣은 메시지의 id를 보내고 그 뒤에 저장된 메시지를 묶음으로 받게 작업했다. 소켓 묶음과 REST로 겹쳐 들어오는 메시지는 서버가 붙인 id로 거르고, 저장 시각으로 묻는 탓에 같은 밀리초에 저장된 메시지는 빠질 수 있다.'
tags = ["설계", "상태 관리"]
+++

<!-- 저자 확인 필요:
- 백그라운드 1분 뒤에 소켓을 끊게 한 이유는 커밋에 없어서 쓰지 않았다
- 다시 받기 전에 돌아온 화면에서 대화가 빠져 보였다는 리포트나 재현 기록이 커밋에 없다. 도입은 코드 구조(끊긴 플레이어에게는 저장만 하고, 예전 join 처리에는 놓친 메시지를 찾아 보내는 부분이 없음)로만 썼다
- foreground 처리, 캐치업 쿼리, 묶음 전송은 백엔드 동료 코드(7월 16일 같은 날). 처음엔 개별 프레임으로 다시 보내다가 같은 날 묶음으로 바꿨는데, 바꾼 이유는 서버 주석에만 있어서 본문에서 뺐다
- 네트워크 재연결은 join을 그대로 쓰는 이유, 기준 chatId를 처리 후에 옮기는 이유는 기록이 없어서 사실만 썼다
- 묶음 안에서 chattype이 없는 메시지(시스템 메시지 등)는 Sentry 경고만 남기고 화면에 넣지 않는다. 의도인지. 본문은 코드 주석으로만 드러냈다
- 다시 연결할 때 페이지 번호를 1로 되감는 이유는 기록이 없어서 사실만 썼다
- 세 번째 단계: 운영에서 같은 밀리초 메시지가 실제로 빠진 적이 있는지는 DB로 확인하지 않았다. 고블린 예시의 시각과 내용은 지어낸 값이고, 동작은 저장 코드(new Date())와 쿼리 조건을 따라가서 확인했다
- 세 번째 단계의 쿼리는 동료 코드이고 10-23 qa 기준으로 아직 $gt다. $gte는 코드에 없는 대안이다. 회사 서비스에서 메시지가 빠질 수 있다는 내용을 공개 글에 써도 되는지
- $gte로도 다른 요청이 더 이른 시각을 찍고 늦게 저장을 마친 메시지는 못 메운다(코드 읽기로만 한 짐작). 본문은 "같은 밀리초"로 범위를 좁혀 썼다
- 순서 글(socket-serial-queue)과 이어지는 글이다. 발행 순서와 서로 링크할지. 페이지네이션 초안의 "놓친 메시지는 마지막으로 받은 메시지를 기준으로 묻는다" 절과 쿼리 설명이 겹친다
- 배운점 소감
- 데모(socket-catchup) 추가. 왼쪽 $gt와 오른쪽 $gte + id 거르기 두 채팅 화면에 같은 소켓 흐름을 재생한다. 메시지와 시각은 본문 예시와 같은 지어낸 값이고, 끊기는 순간과 같은 밀리초에 저장되는 장면을 골라 보여준다. 넣을 위치가 세 번째 단계 끝이 맞는지
-->

회사에서 개발 중인 서비스인 몽글의 플레이 화면은 서버가 소켓으로 보내는 메시지를 채팅처럼 아래로 쌓아서 보여준다. 같은 장소에 있는 다른 플레이어의 채팅은 내가 가만히 있어도 계속 들어온다.

그런데 앱을 백그라운드로 보내고 1분이 지나면 이 소켓을 끊게 작업했다. 서버는 소켓이 끊긴 플레이어에게 온 메시지를 보내지 않고 채팅 기록 DB에 저장만 한다. 그러니까 앱에 돌아와서 다시 연결해도 끊겨 있던 동안 온 메시지는 소켓으로 다시 오지 않는다.

## 첫 번째: 다시 연결할 때 마지막으로 받은 메시지 알려주기

처음에는 다시 연결할 때도 플레이 화면에 처음 들어올 때와 같은 `join`을 보냈다. 서버는 `join`을 받으면 처음 들어온 플레이어처럼 장소 입장 메시지와 둘러보기 연출부터 다시 보내준다. 이 처리에는 끊겨 있던 동안 저장된 메시지를 찾아서 보내는 부분이 없었다.

그래서 백그라운드 타이머 때문에 끊긴 경우에는 다시 연결하면서 `join` 대신 `foreground`를 보내게 했다. 이때 마지막으로 받은 메시지의 `chatId`를 같이 보낸다. `chatId`는 서버가 메시지를 보낼 때마다 붙여주는 id다. 1분이 되기 전에 돌아와서 소켓이 살아 있으면 다시 연결할 일이 없으니 백그라운드로 갔다는 표시만 지운다. 네트워크가 끊겼다 붙어서 다시 연결할 때는 지금도 `join`을 보낸다.

```ts
const handleInactive = () => {
    foregroundReconnectPendingRef.current = true; // 백그라운드로 갔다고 표시해둔다
    // ...
    disconnectTimeoutRef.current = setTimeout(() => {
        disconnectTimeoutRef.current = null;
        disconnect('background-timer'); // 1분이 지나면 끊는다
    }, BACKGROUND_SOCKET_DISCONNECT_DELAY_MS);
};

// 앱이 앞에 있는데 소켓이 끊겨 있으면 다시 연결하는 effect 안
if (foregroundReconnectPendingRef.current) {
    foregroundReconnectPendingRef.current = false;
    requestPaginationReset(); // 위로 올릴 때 받을 페이지 번호를 1로 되감는다
    connect(localStorage.getItem('authToken'), thisGame, {
        type: 'foreground',
        chatId: useChatStore.getState().lastServerChatId, // 마지막으로 받은 메시지
    });
    return;
}

connect(localStorage.getItem('authToken'), thisGame); // 그 외에는 join
```

`lastServerChatId`는 소켓으로 메시지를 받은 순간이 아니라 처리기가 그 메시지를 채팅에 넣기까지 끝낸 다음에 바꾼다. 소켓 메시지는 받자마자 그리지 않고 큐에 넣었다가 하나씩 처리하는데, 소켓을 끊을 때는 아직 처리하지 못한 메시지가 남은 큐도 같이 비운다. 그러니까 큐에 남아 있다가 버려진 메시지도 기준보다 뒤에 있어서 다시 받을 수 있다.

```ts
// processMessage 끝
await chatTypeProcessors[enrichedData.chattype]({ data: enrichedData, addChat /* ... */ });
// ...
if (typeof enrichedData.chatId === 'string') {
    useChatStore.getState().setLastServerChatId(enrichedData.chatId); // 채팅에 넣은 다음에만 기준을 옮긴다
}
```

백엔드에서는 `foreground`를 받으면 입장 메시지와 연출을 건너뛴다. 그리고 받은 `chatId` 뒤에 저장된 메시지를 최신 기준 30개까지 `chatCatchup` 메시지 하나에 묶어서 보내준다. 30개를 넘게 놓쳤으면 `hasMore`도 `true`로 같이 온다.

프론트는 묶음 안의 메시지를 하나씩 채팅으로 바꿔 모은 다음 `addChats`로 한 번에 넣는다. 그리고 묶음의 마지막 `chatId`를 다음 기준으로 기억해둔다.

```ts
if (data.type === 'chatCatchup') {
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const chats: Parameters<typeof addChats>[0] = [];
    const collectChat: typeof addChat = async (chat) => {
        chats.push(chat); // 바로 넣지 않고 모아둔다
    };

    for (const message of messages) {
        const processor = message.chattype ? chatTypeProcessors[message.chattype] : undefined;
        if (!processor) {
            // ... 채팅 처리기가 없는 메시지는 Sentry에 경고만 남기고 넘어간다
            continue;
        }
        await processor({ data: { ...message /* ... */ }, addChat: collectChat /* ... */ });
    }

    if (chats.length > 0) {
        await addChats(chats, playData.id, { markAsFresh: false }); // 한 번에 넣고 등장 애니메이션은 건너뛴다
        // ...
    }
    if (typeof data.hasMore === 'boolean') {
        useChatStore.getState().setCatchupHasMore(data.hasMore); // 30개를 넘게 놓쳤는지
    }
    // ... 묶음의 마지막 chatId로 lastServerChatId를 바꾼다
}
```

## 두 번째: 같은 메시지가 소켓과 REST로 두 번 들어올 수 있다

30개를 넘게 놓쳤으면 묶음에는 최신 30개만 오고, 그보다 오래된 메시지는 채팅을 위로 올릴 때 REST로 받는다. 위로 올려 맨 위에 닿으면 페이지 번호를 붙여 30개씩 더 받아오는 요청이다. 다시 연결할 때 이 페이지 번호를 1로 되감아 두니까 첫 요청인 1페이지에는 방금 묶음으로 받은 메시지가 대부분 다시 들어 있다.

같은 메시지가 소켓과 REST 두 길로 들어오는 셈이라 둘 중 하나는 걸러야 했다. 서버는 메시지를 보낼 때마다 `chatId`를 uuid로 붙이고 DB에도 같은 값으로 저장한다. 그래서 소켓으로 받든 REST로 받든 같은 메시지는 같은 `chatId`를 갖는다. 프론트는 이 값을 채팅 id로 쓰고, 채팅을 넣을 때 이미 들고 있는 id면 넣지 않는다.

```ts
addChats: async (newChats, playDataId, options) => {
    // ...
    const existingIds = new Set(get().chat.map((message) => message.id));
    const chatsWithMeta = newChats.flatMap((newChat): ChatHistory[] => {
        if (newChat.id && existingIds.has(newChat.id)) return []; // 이미 들고 있는 chatId면 넣지 않는다
        // ...
    });
    // ...
},
```

위로 올려 받은 메시지를 위에 붙이는 `prependChats`도 같은 id로 거른다. 그래서 1페이지에서 묶음으로 이미 받은 메시지는 다시 붙지 않는다.

이 id 비교는 원래 3월에 넣어둔 것이다. 단계 진행 응답으로 받은 메시지와 채팅 기록을 불러온 결과가 거의 동시에 들어오면 같은 메시지가 두 번 찍힐 수 있어서, 어느 쪽이 먼저 와도 하나만 남는지를 테스트로 확인해뒀다. 놓친 메시지를 다시 받는 길이 하나 더 생겼지만 같은 비교로 막을 수 있었다. 묶음 안에 같은 id가 섞여 와도 한 번만 넣는지는 테스트로 따로 남겼다.

## 세 번째: 마지막 메시지와 같은 밀리초에 저장된 메시지는 빠질 수 있다

`chatId`는 uuid라서 값만 봐서는 어느 메시지가 먼저인지 알 수 없다. 백엔드는 받은 `chatId`로 그 메시지가 저장된 시각을 찾고, 그 시각보다 뒤에 저장된 메시지를 가져온다.

```ts
anchorDoc = await getCollection("chat_history").findOne(
  {
    receiverPlayDataId: String(playDataId),
    $or: [{ "message.chatId": lastChatId }, { "message.confirmedId": lastChatId }],
  },
  { projection: { timestamp: 1, _id: 1 } },
);
sinceTimestamp = anchorDoc?.timestamp ?? null; // 마지막으로 받은 메시지가 저장된 시각
// ...
if (sinceTimestamp) {
  query.timestamp = { $gt: sinceTimestamp }; // 그 시각보다 뒤에 저장된 것만
}

const docs = await getCollection("chat_history")
  .find(query)
  .sort({ timestamp: -1, _id: -1 })
  .limit(31) // 31개를 받아서 30개를 넘으면 hasMore
  .toArray();
```

그런데 저장 시각은 메시지를 저장할 때마다 `new Date()`로 찍는 값이라 밀리초까지만 있다. 그러니까 같은 플레이어에게 가는 메시지 두 개를 서로 다른 요청이 같은 밀리초에 저장하면 두 메시지의 시각이 똑같아진다.

예를 들어 플레이어 A의 채팅 `고블린 나왔어요`와 플레이어 B의 채팅 `같이 잡아요`가 둘 다 `12:00:05.348`에 저장됐다고 하자. 앱은 `고블린 나왔어요`까지 채팅에 넣은 다음 소켓이 끊겼다. 돌아와서 다시 연결하면 프론트는 `고블린 나왔어요`의 `chatId`를 보내고, 백엔드는 `05.348`보다 뒤에 저장된 메시지만 찾는다. 그런데 `같이 잡아요`도 시각이 `05.348`이라 이 조건에 걸리지 않는다. 정작 못 받은 메시지가 묶음에서 빠지는 것이다.

쿼리는 시각이 같으면 `_id`로 순서를 한 번 더 정한다. 하지만 이건 조건을 통과한 메시지끼리의 순서라서, `$gt` 조건에서 빠진 `같이 잡아요`는 정렬할 대상에도 없다.

기준과 같은 시각까지 `$gte`로 물으면 `같이 잡아요`도 묶음에 들어온다. 대신 이미 채팅에 있는 `고블린 나왔어요`도 다시 오는데, 앞에서 본 id 비교가 이걸 걸러서 화면에는 한 번만 찍힌다.

{{< demo name="socket-catchup" height="auto" >}}

## 배운점

놓친 메시지를 다시 받을 때 서버에 알려주는 건 마지막으로 받은 메시지 하나였다. 이 기준이 어긋나면 메시지가 빠지고, 기준을 겹치게 잡으면 같은 메시지가 두 번 들어온다. 빠진 메시지는 화면에서 알아챌 방법이 없지만 두 번 들어온 메시지는 서버가 붙인 id로 거를 수 있다.

결국 다시 받을 때는 조금 겹치게 받고 id로 거르는 게 빠뜨리는 것보다 나은 것 같다.
