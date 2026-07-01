+++
date = '2026-07-01T23:33:46+09:00'
draft = false
title = 'React.memo가 오히려 리렌더를 유발했던 3가지 이유'
+++

## 리렌더 하지 말랬더니 더 하는 현상

| memo로 감쌌는데 왜 리렌더가 계속 되지?

결론부터 말하면 내가 memo가 비교하기 어려운 형태로 props를 넘기고 있었다.

### 객체, 배열, 함수를 인라인으로 넘기는 경우

```
<ChatMessageItem
  actions={["reply", "copy"]}
  style={{ marginTop: 4 }}
/>
```

그 경우 memo는 참조를 비교하기 때문에

```
{} !== {}
[] !== []
```

props가 바뀐 것으로 판단해서 그냥 리렌더한다.
동적으로 계산해야 하면 useMemo, 함수면 useCallback으로 참조를 안정화해야 한다.

### children도 props다

```
const Card = React.memo(({ children }) => <div>{children}</div>);

function Page() {
return (
<Card>
<Button />
</Card>
);
}
```

이 `<Button />` 컴포넌트는 memo를 하고있지만 사실은 렌더마다 새로운 React element를 생성한다. Wrapper인 Card 입장에서 children은 항상 새 값이라 memo의 의미가 없어지는 것이다.

### context 변경에도 리렌더된다

```
const UserName = React.memo(() => {
  const { user } = useContext(UserContext);
  return <span>{user.name}</span>;
});
```

이렇게 memo해도 context가 바뀌면 결국 리렌더된다. memo는 props 비교를 하지 context 구독까지 막는 게 아니기 때문이다. 이 경우엔 context 범위를 더 좁히거나
Zustand처럼 selector로 필요한 값만 구독하는 방식으로 해결할 수 있다.

## 깨달은 점

memo를 붙이기 전에 "이 컴포넌트에 들어오는 값이 매번 새로 만들어지고 있지 않은가?"를 먼저 봐야겠다는 것을 깨닫게 되었고 그냥 대략적인 이해를 가지고 코드를 작성하면 프레임워크의 장점을 많이 활용할 수 없다는 것을 알게되었다.
