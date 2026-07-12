+++
date = '2026-07-08T00:14:11+09:00'
draft = false
title = '락을 걸어도 race condition이 발생하는 3가지 패턴'
+++

개발하면서 가장 해결하기 어려웠던 버그는 간헐적으로 발생하는 문제였다. 재현이 어렵고 코드상으로는 문제가 없어 보여서 원인을 찾는 데 시간이 좀 걸렸기 때문이다.

이 글에서 다룰 race condition 문제가 딱 그랬다. _간헐적으로_ SSE가 두 번 연결되는 문제, _간헐적으로_ SQLite 배치 insert가 중복 실행되는 문제, _간헐적으로_ 채팅 메시지가 두 번 전송되는 문제가 있었다. 처음에는 각각 다 다른 문제라고 생각했고 리포트 시점도 다 달랐다. 그래서 각각 해결을 하게되었는데 세 번째 문제를 해결하고 나서야 이 셋이 결국 같은 패턴이라는 걸 알게 됐다.

> 체크와 상태 변경 사이에 비동기 작업이 있으면 race condition이 발생할 가능성이 생긴다.

## 첫 번째: SSE 중복 연결

처음 만난 문제는 SSE 연결을 작업할 때였다.

```ts
function useSSE() {
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (eventSourceRef.current) return; // 연결 되어있으면 return

    fetchAuthToken().then((token) => {
      eventSourceRef.current = new EventSource(`/sse?token=${token}`);
    });
  }, []);
}
```

코드를 보면 알 수 있듯이 이미 연결되어 있으면 return하도록 처리했기 때문에 중복 연결이 일어날일은 없어보였다. 하지만 실제로는 그렇지 않고 중복 연결이 일어났다. 도대체 어떻게 된 일일까?

(console.log를 분기마다 일일히 찍어서) 확인해본 결과 흐름은 아래와 같았다.

1. 최초 연결 시 eventSourceRef 확인
2. null이니까 통과
3. fetchAuthToken 실행
4. EventSource 아직 생성 전
5. 같은 effect 재실행 (React StrictMode 여서 그랬다)
6. source 생성 전이니까 eventSourceRef는 여전히 null
7. 다시 통과

문제는 체크 자체가 아니라 체크 이후 상태 변경 전에 **비동기 작업**이 끼어있었다는 것이었다. 중복 실행된 원인을 알고나니 수정은 어렵지 않았다. 비동기 작업 전에 먼저 상태를 변경해서 다른 실행이 들어오지 못하게 했다.

```ts
const connectingRef = useRef(false);

useEffect(() => {
  if (connectingRef.current) return;

  connectingRef.current = true; // 여기서 바로 상태 변경

  fetchAuthToken().then((token) => {
  eventSourceRef.current = new EventSource(...);
  connectingRef.current = false; // 락 해제
})
.catch(() => {
  connectingRef.current = false; // 에러 시에도 락은 해제해준다
});
```

## 두 번째: SQLite 배치 재진입

다음으로 만난 문제는 여러 insert 요청을 모아서 batch 처리하는 코드 쪽이었다.

```ts
async flushPendingInserts() {
  const pending = this.pendingInserts;

  this.pendingInserts.clear();

  await db.execute('BEGIN TRANSACTION');

  await db.executeSet(pending);

  await db.execute('COMMIT');
}
```

Capacitor 앱에서 chat history를 SQLite에 batch insert하는 과정에서 transaction 충돌이 발생해서 계속 에러가 나는 현상이 있었다.

첫 번째 flush가 transaction 진행 중인데 두 번째 flush가 시작되면서 같은 작업이 동시에 실행됐기 때문이었고 이미 처리 중인지 아닌지를 판단하는 분기가 없어서 그런 것으로 파악했다.

```ts
async flushPendingInserts() {
  if (this.isFlushing) return;

  this.isFlushing = true;

  try {
    // batch 처리
  } finally {
    this.isFlushing = false;
  }
}
```

이런식으로 바로 락을 잡는 형태로 변경해서 해결할 수 있었다.

## 세 번째: 채팅 메시지 중복 전송

이번에는 QA fail건이었던 "사용자가 send 버튼을 빠르게 두 번 클릭하면 같은 메시지가 두 번 전송되는 현상" 이었다.

```ts
async function handleSend() {
  if (input.trim() === "") return;

  const text = input;

  setInput("");

  await sendChatMessage(text);
}
```

코드상으로는 `setInput('')`을 바로 호출했으니 문제가 없을 것처럼 보였지만 실제로는 두번 전송되는 현상이 있었다.

같은 렌더에서 참조하는 state는 snapshot 처럼 동작하므로 변경할 수 없다.
따라서 첫 번째 클릭에서 setInput('')을 호출해도 현재 실행 중인 handler와 이미 생성된 이벤트 흐름에서는 이전 input 값을 계속 사용할 수 있다.
그래서 결국 두 번째 클릭도 같은 값을 가지고 실행될 수 있었다.

```ts
// 첫번째 클릭
input = "hello";

setInput("");
sendChatMessage(text); // "hello"
```

이처럼 setInput 변경이 반영되는 사이에 두 번째 클릭이 들어오면 아직 input 값은 "hello"일 수 있다는 것이 문제였다.

```ts
sendChatMessage("hello");
sendChatMessage("hello");
```

ref로 동기 락을 걸어주는 것으로 해결했다.

```ts
const sendingRef = useRef(false);

async function handleSend() {
  if (sendingRef.current) return; // 아직 돌고있으면 return
  if (!input.trim()) return;

  sendingRef.current = true; // 락을 건다

  try {
    const text = input;

    setInput("");

    await sendChatMessage(text);
  } finally {
    sendingRef.current = false; // 락을 푼다
  }
}
```

useState는 다음 렌더링에서 반영되지만 ref.current는 즉시 변경되기 때문에 이 방법이 바로 먹혔다.

## 전혀 다른 도메인, 동일한 패턴

세 사례를 다시 보면 구조가 완전히 같다. `처리중인지 체크 > 비동기 작업 > 완료로 변경` 순이다.

JS는 싱글 스레드라 안전하다고 무심코 생각했는데 `await`을 만나는 순간 그 사이에 같은 함수가 다시 호출될 수 있었다. 일종의 `동시성`인 셈이다.

그래서 상태 체크와 상태 변경 사이에 비동기 실행이 껴있으면 두번째 호출의 상태 체크가 첫번째 호출의 상태변경보다 먼저 일어나서 둘 다 체크를 통과해버릴 수 있었던 것이다.

스레드 동시성 문제 해결과 비슷하게 상태 체크와 락 거는 부분을 동기적으로 붙여서 비동기가 끼어들 틈을 아예 없애버려서 스레드 환경에서 사용하는 mutex와 비슷한 방식으로 해결할 수 있었다.

> mutex: 여러 스레드나 프로세스가 하나의 공유 자원에 동시에 접근하는 것을 막는 동기화 기법 (그러니까 lock이다 결국)

```ts
if (processing) return;

processing = true; // 비동기 로직 전에 동기 락을 걸어준다.

try {
  await something();
} finally {
  processing = false; // 다 끝나고 나서 푼다.
}
```

## 배운 점

처음에는 세 문제가 모두 다른 원인이라고 생각했다.

SSE는 리액트 lifecycle 문제, SQLite는 transaction 문제, 채팅은 사용자 입력 쪽 문제라고 생각했다.

하지만 결국 핵심은 동일했다. 비동기 작업이 시작된 이후 상태가 변경되기 전에 다른 실행이 들어올 수 있다는 것이다.

세 문제를 겪고 나서 async 함수를 작성할 때 "이 함수가 중복 실행돼도 될까?" 먼저 생각하게 되었다. 중복 실행되면 안 되는 작업이라면 await 이후가 아니라 함수 진입 시점에 락을 걸어줘야 한다.
