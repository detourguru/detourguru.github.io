+++
date = '2026-07-07T00:12:05+09:00'
draft = false
title = 'try-catch가 항상 정답이 아닌 이유'
+++

개발하다 보면 화면 한 켠에서 가끔씩 이런 에러가 찍힐 때가 있다.

```text
TypeError: Cannot read properties of undefined (reading 'name')
```

```tsx
function GameInfo({ game }) {
  return <div>{game.name}</div>;
}
```

확인해보면 대부분은 멀쩡히 잘 동작하는데 간헐적으로 `game`이 `undefined`로 들어온다. 재현도 잘 안될 뿐더러 화면도 다시 새로고침하면 멀쩡해 보인다. 이럴 때 제일 만만한 선택지가 하나 있다. 그냥 에러가 안나게 감싸버리는 것이다 ㅋ

```tsx
function GameInfo({ game }) {
  try {
    return <div>{game.name}</div>;
  } catch {
    return null;
  }
}
```

내 경우에는 내가 suspense query를 사용하니까 그냥 간헐적으로 undefined인 상황이 생겨서 그런가보다~ 하고 넘어갔다. try-catch로 감싸 에러가 터지지만 않게 해버린채로 말이다.

## try-catch가 숨긴 에러는 언젠가는 다시 드러난다

당연히 이렇게 숨긴 에러는 얼마 안있어 다시 나타난다.

이 케이스도 다시 사내 테스트에서 발견됐다. 문의를 제기한 사용자의 계정으로 로그인해보니 신규 가입 사용자라 아직 게임 데이터가 없는 상태였고 API가 404를 반환하고 있었다. 그런데 `fetch`가 404 응답을 에러로 처리하지 않고 그대로 다음 로직으로 전달하다 보니 데이터가 없는 상태가 하나의 정상 흐름처럼 처리되어 결국 `undefined`가 컴포넌트까지 그대로 전달된 것이었다.

원인을 알고 나니 수정은 명확했다.

```ts
const { data: game } = useGameQuery({
  gameId,
  select: (res) => (res.status === 404 ? null : res.data),
});
```

데이터 없음 상태를 명시적으로 응답으로 내어주고나니 더 이상 undefined가 몰래 컴포넌트까지 새어 들어오지 않게되었다.

## try-catch가 항상 정답이 아닌 이유?

사실 뻔하다. try-catch는 에러가 화면에 노출되지 않도록 막아줄 뿐이지 game이 왜 undefined인지에 대한 답은 하나도 주지 않기 때문이다.

근데 왜 try-catch를 쓰느냐? 에러가 났을 때 화면이 멈추지 않게 하면서도 사용자에게 에러를 어떻게 보이게 할 것인지를 결정할 수 있기 때문이다. 하지만 에러가 발생한 원인을 파악할 수 있게 하는 코드는 아니므로 catch문에서 sentry나 로그처럼 에러를 파악할 수 있는 코드를 넣어두는 것이 중요하다.
