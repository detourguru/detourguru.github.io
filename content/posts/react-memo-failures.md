+++
date = '2026-07-01T23:33:46+09:00'
draft = false
title = 'React.memo가 오히려 리렌더를 유발한다?'
+++

## 리렌더 하지 말랬더니 더 하는 현상

> memo로 감쌌는데 왜 리렌더가 계속 되지?

채팅 서비스를 만들다보니 채팅이 하나 추가될때마다 모든걸 다 다시 그리는 리렌더 현상이 있었고 체감이 될정도로 화면이 많이 느려졌었다.

게다가 네트워크 탭에서 보면 특정 쿼리는 막 한번 채팅 추가될때마다 열개씩 늘어나기도 했다.

그래서 이 비용을 줄여보기위해 거의 모든 곳에 memo나 useMemo를 통해 리렌더를 줄여보려 노력한 적이 있었다.

하지만 기대하는 것처럼 드라마틱한 효과가 없었다. 오히려 deps 관리 때문에 더 비용이 증가하기만 했다.

### 객체, 배열, 함수를 인라인으로 넘기는 경우

```tsx
<ChatMessageItem actions={["reply", "copy"]} style={{ marginTop: 4 }} />
```

그 경우 memo는 참조를 비교하기 때문에

```ts
{} !== {}
[] !== []
```

props가 바뀐 것으로 판단해서 그냥 리렌더한다.
동적으로 계산해야 하면 useMemo, 함수면 useCallback으로 참조를 안정화해야 한다.

### children도 props다

```tsx
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

```tsx
const UserName = React.memo(() => {
  const { user } = useContext(UserContext);
  return <span>{user.name}</span>;
});
```

이렇게 memo해도 context가 바뀌면 결국 리렌더된다. memo는 props 비교를 하지 context 구독까지 막는 게 아니기 때문이다. 이 경우엔 context 범위를 더 좁히거나
Zustand처럼 selector로 필요한 값만 구독하는 방식으로 해결할 수 있다.

## 그래서 누가 memo를 깨트렸는가

store 전체 구독 문제를 selector로 정리한 뒤에도 채팅이 여전히 무거운걸 발견했다. 그런데 이번엔 props가 범인이었다. 각 메시지 컴포넌트가 전체 메시지 개수를 prop으로 받고 있었는데 새 메시지가 올 때마다 전체 메시지 개수가 바뀌면서 마운트된 모든 메시지의 memo 비교가 매번 깨지고 있었던 것이다. 채팅 개수가 늘어나면 날수록 엄청나게 버벅이고 느리길래 실측해보니 최대 채팅 1개 당 264ms까지 찍히는 수준이었다.

그래서 부모가 한 번만 계산한 `isLastMessage` boolean 값을 prop으로 내려주도록 바꿨다. 새 메시지가 와도 이 값이 바뀌는 건 직전 마지막 메시지 하나뿐이라서 나머지 메시지들은 props가 그대로라 memo가 제대로 작동하게 됐다.

사실 이전에는 렌더되는 메시지 개수를 제한해서 임시 수정을 했었는데 그건 리렌더 대상 수만 줄이는 것이지 매번 비교가 깨진다는 원인은 그대로였다. 비교가 깨지는 지점을 고치자 근본적으로 해결이 되었다!

## 깨달은 점

memo를 붙이기 전에 "이 컴포넌트에 들어오는 값이 매번 새로 만들어지고 있지 않은가?"를 먼저 봐야겠다는 것을 깨닫게 되었고 그냥 대략적인 이해를 가지고 코드를 작성하면 프레임워크의 장점을 많이 활용할 수 없다는 것을 알게되었다.
