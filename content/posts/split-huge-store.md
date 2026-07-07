+++
date = '2026-07-08T00:13:18+09:00'
draft = false
title = '거대 zustand store 도메인 책임 분리하기'
+++

처음에는 플레이 화면에서 필요한 상태를 하나의 Zustand store에 한번에 관리했다.

import 하나면 되고 어디서든 같은 store를 바라보면 됐으니 호출부도 간단했고 편리했다.

```tsx
const useGameStore = create<GameState>((set) => ({
  // 객체들
  items: [],
  locations: [],

  // 게임 메타
  gameInfo: null,
  gameSettings: null,

  // 액션들
  addMessage: () => {},
  setStep: () => {},
  ...
}));
```

처음에는 문제가 없어보였지만 기능이 추가되면서 store는 점점 비대해졌다.

게다가 더 큰 문제는 내부에서 서로가 서로의 상태를 참조/의존하게 되었다는 점이다.

결국 하나의 store에 채팅, 게임 진행 등 모든 상태를 관리하는 800줄 가까운 파일이 됐다.

가장 불편했던 부분은 단순히 긴 것이 아니라 변경 영향의 범위를 파악하기 어려워진 것이었다.

예를 들어 step 변경 시 임시 채팅 메시지를 제거하는 로직이 있었다.

```ts
setStep: (next) =>
  set((s) => ({
    currentStepIndex: next,
    messages: s.messages.filter((m) => m.persistent), // 임시 메시지 제거
  }));
```

step 변경 액션인데 내부에서는 chat 상태도 변경하고 있었으므로 액션 하나를 수정할 때 어떤 상태가 영향을 받는지 직관적으로 파악하기 어려웠다.

실제로 step 관련 로직을 수정하다가 이 필터링 로직을 그대로 지나칠 뻔한 적이 있었다. 도대체 무슨 동작으로 채팅에 필터링이 일어나는지 코드를 한참 거슬러 올라가야지만 알 수 있는 부분이었다. 너무 비대해서 안그래도 읽기도 힘든데 하나의 액션으로 여러 도메인에 수정이 일어나다니! 변화가 필요하다고 생각했다.

## 도메인 기준으로 store 분리

store를 나누는 기준은 여러가지가 있을 수 있겠지만 나는 그 중 도메인을 기준으로 잡았다.
각각 변경 주체와 생명 주기도 달랐고 작업중인 서비스가 도메인이 워낙 복잡한 서비스다보니 이렇게 나누는게 가장 직관적일 것 같다는 판단에서였다.

```text
useChatStore // 채팅
- messages
- unreadCount

useStepStore // step (게임 진행)
- steps
- currentStepIndex

useGameInfoStore // 게임 메타
- gameInfo
- gameSettings

useUIStore // UI 상태 관리
- isMenuOpen
- selectedTab
```

분리 후 `setStep`은 더 이상 채팅 상태를 알지 못한다.

```ts
// useStepStore
setStep: (next) => set({ currentStepIndex: next }),
```

이제 이 액션은 이름 그대로의 일만 한다. step을 바꾸는 것 외에 다른 부수효과가 없다는 걸 코드만 보고도 확신할 수 있게 됐다.

결과적으로 각 store의 역할이 명확해졌다.

## store 간 의존성은 hook에서 분리

하지만 store를 나눈다고 끝이 아니라 새로운 문제가 생겼다. 많은 상태값들이 도메인 간 상호작용이 필요했다. step 변경 시 chat 초기화가 필요한 아까의 예시처럼 말이다.

처음에는 store 안에서 다른 store를 직접 호출했었지만 코드만 봐서는 하나의 변경이 다른 변경을 초래한다는 사실을 알기 어렵다는 단점이 있었다.

그래서 store 간 의존성은 최대한 밖으로 꺼내어 페이지 hook에서 조합했다.

```tsx
function useGamePlayPage() {
  const setStep = useStepStore((state) => state.setStep);

  const clearMessages = useChatStore((state) => state.clearTransientMessages);

  const changeStep = (next) => {
    setStep(next);
    clearMessages();
  };

  return {
    changeStep,
  };
}
```

이렇게 하면 `changeStep`이라는 이름만으로도 step이 change 될때 어떤 일이 일어나는지 어딜 확인하면 될지 바로 알 수 있게 되었다. store 내부를 열어보지 않아도 무슨 일이 일어나는지 알 수 있다는 게 가장 큰 차이였다.

## 배운점

편하자고 하나에 몰아넣었다가 어디에서 액션이 일어나는지도 모르게 될 뻔했지만 분리 이후 store는 상태만 관리하고 페이지 hook은 여러 상태와 사용자 액션을 조합하는 역할을 맡게 됐다. 상태 변경 시 영향 범위를 예상하기 쉬워졌고 흐름 추적도 훨씬 용이해졌다. 특히 테스트 코드를 쓸 때 mock을 전부 만들어줄 필요 없이 필요한 store만 만들면 되어서 부담이 많이 덜어졌다.

물론 store를 무조건 잘게 쪼갠다고 정답은 아닌 것 같다. 여러 store를 import해야 해서 컴포넌트 코드가 좀 못생겨졌기도 하고 도메인 간 의존성을 어디서 처리하는 게 적절한지에 대한 설계 고민은 오히려 늘었다. 하지만 도메인이 복잡한 내 서비스에는 이 방식이 맞았다. store 하나당 책임이 명확해졌을 뿐만 아니라 읽는 사람도 코드를 따라가기 훨씬 쉬워졌다.
