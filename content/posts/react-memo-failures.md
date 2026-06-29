+++
date = '2026-06-30T01:47:46+09:00'
draft = true
title = 'React Memo Failures'
+++

# React.memo가 동작하지 않았던 3가지 이유

> "memo로 감쌌는데 왜 리렌더가 계속 되지?"

React 최적화를 처음 공부할 때 가장 많이 했던 착각이다.

`React.memo`로 감싸면 부모가 리렌더돼도 props가 같으면 자식은 다시 그리지 않는다고 배웠다.

그런데 실제 프로젝트에서는 memo를 붙였는데도 계속 렌더링되는 경우가 있었다.

처음에는 React가 이상한 줄 알았다.

결론부터 말하면 React.memo가 문제였던 적은 거의 없었다. 대부분 내가 memo가 동작하기 어려운 형태로 props를 넘기고 있었다.

---

## 1. 객체, 배열, 함수를 inline으로 넘기는 경우

가장 처음 만난 케이스.

```tsx
<ChatMessageItem
  message={message}
  actions={["reply", "copy"]}
  style={{ marginTop: 4 }}
/>
```

보기에는 같은 값이다.

하지만 React 입장에서는 매 렌더마다 새로운 배열과 객체다.

memo는 값을 깊게 비교하지 않고 참조를 비교한다.

```ts
{} !== {}
[] !== []
```

이기 때문에 props가 바뀐 것으로 판단한다.

동적으로 계산해야 하는 값이면 `useMemo`, 함수면 `useCallback`으로 참조를 안정화해야 한다.

다만 이걸 모든 곳에 적용하기 시작하면 코드가 복잡해진다. 그래서 지금은 memo가 실제로 필요한 컴포넌트에서만 적용한다.

---

## 2. children도 props다

이건 예상하지 못했던 케이스였다.

```tsx
const Card = React.memo(({ children }) => {
  return <div>{children}</div>;
});

function Page() {
  return (
    <Card>
      <Button />
    </Card>
  );
}
```

`children`도 결국 props다.

JSX로 작성한 `<Button />`은 렌더마다 새로운 React element가 만들어진다.

그래서 Card 입장에서는:

```
이전 children !== 현재 children
```

이 된다.

특히 `Card`, `Layout`, `Section` 같은 wrapper 컴포넌트는 children이 자주 바뀌기 때문에 memo 효과를 기대하기 어렵다.

이후에는 "모든 컴포넌트를 memo로 감싸자"보다 "정말 렌더 비용이 큰 컴포넌트인가?"를 먼저 보게 됐다.

---

## 3. context 변경은 memo가 막아주지 않는다

가장 헷갈렸던 케이스.

```tsx
const Component = React.memo(() => {
  const theme = useContext(ThemeContext);

  return <div>{theme}</div>;
});
```

props는 아무것도 바뀌지 않았다.

그런데 context 값이 변경되면 Component는 다시 렌더링된다.

이유는 간단하다.

`React.memo`는 props 비교를 위한 기능이지 context 구독 변경까지 막는 기능이 아니기 때문이다.

이때는 context 범위를 좁히거나, 자주 변경되는 상태는 selector 기반 상태 관리로 분리하는 방법을 사용했다.

---

## 실제로는 세 가지가 같이 있었다

내 코드에서는 한 가지 문제만 있었던 게 아니었다.

- inline 함수 props
- inline 객체인 context value
- children으로 넘긴 JSX

이 세 가지가 한 번에 들어가 있었다.

memo를 붙이고 "왜 안 되지?"라고 생각했는데, 정작 memo가 비교할 수 있는 안정적인 props가 거의 없었다.

---

## 배운 것

### 1. React.memo는 렌더링을 막는 마법이 아니다

props가 안정적일 때만 의미가 있다.

### 2. memo를 적용하려면 props 설계부터 봐야 한다

memo를 추가하기 전에 "이 컴포넌트에 들어오는 값이 매번 새로 만들어지고 있지는 않은가?"를 먼저 확인한다.

### 3. 최적화는 측정 후에 한다

예전에는 리렌더가 발생하면 바로 줄여야 한다고 생각했다.

하지만 대부분의 경우 작은 컴포넌트의 리렌더는 문제가 아니었다.

Profiler로 실제 비용을 확인하고, 필요한 곳에만 memo를 적용하는 쪽으로 바뀌었다.

---

## AI가 도와준 부분

처음에는 AI에게 "React.memo가 왜 안 먹히냐"고 물었다.

inline object, 배열 같은 기본적인 원인은 빠르게 찾을 수 있었다.

하지만 실제 프로젝트에서는 context 구조나 컴포넌트 설계 문제까지 같이 얽혀 있었다.

결국 중요한 건 memo 사용법 자체보다 "왜 이 컴포넌트가 다시 그려지는지" 원인을 찾는 과정이었다.
