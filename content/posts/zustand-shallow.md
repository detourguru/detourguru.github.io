+++
date = '2026-07-02T00:19:01+09:00'
draft = false
title = 'Zustand에서 불필요한 리렌더를 막는 법'
description = '채팅 하나 추가될 때마다 헤더·푸터·사이드바까지 리렌더됐다. selector와 useShallow로 구독 범위를 좁힌 기록.'
tags = ["React", "상태 관리", "성능 최적화"]
+++

## 채팅 하나 추가됐을 뿐인데

> 메시지 한 개가 화면에 추가될 때마다 헤더, 푸터, 사이드바까지 전부 리렌더되고 있었다.

네트워크 탭을 보고있으면 너무 이상한점이 있었다. 이 수십개씩 요청되는 API는 뭐지?
알고보니 채팅이 추가 될 때마다 전부 다 리렌더 되는 구조로 코드가 작성되어있었던 것이다.
어쩐지 가상화 스크롤까지 적용했는데도 너무 느렸고 API 요청도 채팅 추가 될때마다 여러개가 나가고있었다. 스스로 디도스 공격을 하고있었다니...

```tsx
function ChatHeader() {
  const { unreadCount } = useChatStore();
}

function ChatBody() {
  const { messages, isLoading } = useChatStore();
}
```

useChatStore()만 호출하면 store 전체를 구독하는 셈이다. messages가 바뀌면 unreadCount만 보는 ChatHeader도 리렌더된다.
Profiler로 확인하니 메시지 1건 추가에 한 화면이 30번 리렌더되고 있었다. 250ms. 이러니 스크롤이 버벅일 만했다.

## 1. selector로 필요한 값만 구독

```tsx
function ChatHeader() {
  const unreadCount = useChatStore((s) => s.unreadCount);
}

function ChatBody() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
}
```

이렇게 selector로 필요한 값만 구독한다면 솔직히 코드는 좀 길어지고 내 기준으로 안예뻐 보이긴 하지만 그래도 관련 없는 값이 바뀔때는 재렌더되지 않는다.

### 객체 selector는 항상 리렌더된다

사실 코드가 너무 안예뻐 보여서 하나의 store에서 두 값을 같이 받으려고 이렇게 써보기도 했다.

```ts
const { messages, isLoading } = useChatStore((s) => ({
  messages: s.messages,
  isLoading: s.isLoading,
}));
```

그런데도 여전히 리렌더됐다. 원인은 selector가 매번 새 객체를 반환하기 때문이다. Zustand는 Object.is로 비교하는데 새 객체는 항상 다르다고 판단한다. 그러니 항상 리렌더 될 수밖에.

## 2. useShallow 사용하기

```ts
import { useShallow } from "zustand/react/shallow";

const { messages, isLoading } = useChatStore(
  useShallow((s) => ({ messages: s.messages, isLoading: s.isLoading })),
);
```

그러니 만약에 하나의 store에서 여러값을 가져오려면 얕은 비교로 가져오면된다.
얕은 비교는 내용이 같으면 같다고 판정한다. 그러니 두 값이 다 바뀌지 않으면 리렌더는 일어나지 않는다.

## 3. selector가 새 값을 만들고 있지 않은지 보기

여기까지 하고도 리렌더가 발생하는 경우가 있었는데 대부분은 selector 안에서 값을 새로 만들고 있는 경우였다.

```ts
// 매 호출마다 새 배열이 나오니 shallow 비교도 소용이 없다
const unread = useChatStore((s) => s.messages.filter((m) => !m.read));
```

`useShallow`는 반환된 객체의 한 겹만 비교하는데 그 안에 든 배열이 매번 새 참조가 되다보니 항상 다르다고 판정된다. 그래서 selector 밖으로 빼서 원본만 구독하도록 바꿨다.

```ts
const messages = useChatStore((s) => s.messages);
const unread = useMemo(() => messages.filter((m) => !m.read), [messages]);
```

## 대망의 결과

- 이전: 메시지 1건 추가 -> 30회 리렌더 / 250ms
- 이후: 메시지 1건 추가 -> 3회 리렌더
- 스크롤 끊김 없어지고 CPU 사용률도 절반으로 떨어졌다.

야호~! 이게 바로 리팩토링의 성과지.

## 배운 것

- selector 없이 쓰면 store 전체 구독이다
- 객체 반환 셀렉터는 useShallow 필수
- selector는 값을 꺼내오기만 하고 파생 계산은 밖에서 하자. 안에서 만들면 매번 새 참조라 비교가 깨진다
- 리렌더를 줄일 땐 Profiler로 누가 왜 리렌더됐는지부터 확인하는 습관을 기르자