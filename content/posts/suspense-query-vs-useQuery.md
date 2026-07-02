+++
date = '2026-07-02T23:48:43+09:00'
draft = false
title = 'useSuspenseQuery vs useQuery 둘 중 뭘 고를까?'
+++

## useSuspenseQuery를 선택한 이유

처음 React Query를 도입하기로 결정했을때 useQuery를 쓸지 useSuspenseQuery를 쓸지 고민하는 과정에서
아래 이유 때문에 useSuspenseQuery를 선택하게 되었다.

- 렌더 시점에 항상 데이터를 보장한다
- 컴포넌트 내에 isLoading, isError 분기가 불필요하다.
- 에러 관리도 상위 `ErrorBoundary`에서 한번에 한다.
- 타입도 논옵셔널이니까 체이닝 안붙고 깔끔하다.

```tsx
// useQuery
const { data, isLoading, isError } = useQuery({ ... });
if (isLoading) return <Spinner />;
if (isError) return <ErrorFallback />;

// useSuspenseQuery
const { data } = useSuspenseQuery(...);

return <Location name={data.name} />;
```

실시간 fetching이 많은 에디터 UI에 잘 맞아 보였고, 코드를 깔끔하게 쓰고 싶었기 때문에 당연히 이걸 써야지! 싶었다.

## 예상하지 못했던 문제

하지만 서비스를 붙여보니 이상한 요청들이 네트워크 탭에 계속 보였다.

```
GET /events?id[]=&gameId=undefined
GET /locations/
GET /buttons?locationId=
```

### useSuspenseQuery는 enabled 옵션을 제공하지 않는다

```ts
const { data } = useSuspenseQuery({
  queryKey: ['LOCATION', { id: locationId }],
  queryFn: () => fetchLocation(locationId),
  enabled: !!locationId, // ts 에러남
});
```

페이지가 처음 렌더링되는 시점에는 URL param이나 상위 API의 결과가 아직 준비되지 않은 상태였는데, useSuspenseQuery는 그 상태에서도 Query를 바로 실행하고 있었던 것이다.
결국 아직 존재하지 않는 값을 그대로 API에 보내게 되어 빈 요청이 발생했다.

우리 서비스의 에디터 페이지 처럼 param이 준비된 이후에만 요청해야 하는 경우에는 이 모델이 맞지 않았다.

### Suspense query와 useQuery 이원화로 해결하다

처음에는 enabled 옵션으로 가드를 넣어서 해결해 볼 수 있을 것 같았는데 Suspense는 "이 컴포넌트는 데이터를 반드시 가지고 렌더링된다."는 모델을 전제로 하기 때문에 enabled 옵션으로 조건부 호출을 한다는 개념 자체가 성립하지 않았다.
그래서 param이 비동기적으로 오거나 조건부 fetch가 필요한 hook은 useQuery로 나머지는 useSuspenseQuery를 그대로 유지했다.

- hook이 호출되는 시점에 param이 무조건 정의되어 있으면 → useSuspenseQuery
- 조건부거나 비동기적으로 온다면 → useQuery + enabled 가드 + 옵셔널 체이닝

이렇게 전환하고나니 빈 param 요청은 사라지게 되었다.

## 배운 점

처음에는 useSuspenseQuery가 useQuery보다 더 좋은 Hook이라고 생각했다.

실제로도 렌더링 시점에 데이터가 항상 보장되는 경우에는 useSuspenseQuery가 코드도 간결하고 관리하기 편했다.

하지만 반대로 URL Param이나 상위 API의 결과처럼 조건부로 요청을 시작해야 하는 데이터라면 useQuery와 enabled를 사용하는 편이 훨씬 자연스러웠다.

이번 경험을 통해 중요한 것은 어떤 Hook이 더 좋은가가 아니라 서비스에서 데이터가 언제 준비되고 언제 요청되어야 하는지를 먼저 이해하는 것이라는 점을 배웠다.
