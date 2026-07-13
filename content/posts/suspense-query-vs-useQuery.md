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
  queryKey: ["LOCATION", { id: locationId }],
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

- hook이 호출되는 시점에 param이 무조건 정의되어 있으면 -> useSuspenseQuery
- 조건부거나 비동기적으로 온다면 -> useQuery + enabled 가드 + 옵셔널 체이닝

이렇게 전환하고나니 빈 param 요청은 사라지게 되었다.

## 산넘어 직렬 워터폴

그런데 에디터에서 조회 화면에 진입해보면 참조 데이터 쿼리들이 줄줄이 이어지면서 API 22요청에 4.6초가 걸리고 있었다 (중복 fetch도 많았고 말이다).

한 컴포넌트에서 useSuspenseQuery를 여러 번 부르면 첫 쿼리가 suspend되는 동안 두 번째 쿼리는 시작조차 못 하기 때문임을 알게됐다. 앞 요청이 끝나야 다음 요청이 출발하는 직렬 워터폴이 생긴 것이다.

Suspense를 제거하고 useQuery로 전환한다음에 enabled 옵션을 사용할까? 근데 그렇게되면 모든 폼에 null 가드가 필요해지기도 했고 많이 쓰는 화면이라 위험이 너무 컸다.

그래서 진입 시점에 `prefetchQuery`로 미리 캐싱을 하는 방법을 선택했다. 화면 진입 시 공용 참조 목록을 prefetchQuery로 병렬로 쏘아 캐시를 해두면 이후 useSuspenseQuery들은 캐시 히트라 suspend 없이 통과했다. 결과적으로는 10개 요청에 2.4초로 줄어들어 훨씬 가벼워졌다.

한 가지 주의할 점은 prefetch 키가 실제 소비하는 쿼리 키와 한 글자라도 다르면 캐시 미스라서 아무 효과가 없다는 것이다. 그래서 prefetch 키는 소비 쿼리 키와 완전히 동일한 상수를 쓰도록 강제했다.

## 배운 점

처음에는 useSuspenseQuery가 useQuery보다 더 좋은 Hook이라고 생각했다.

실제로도 렌더링 시점에 데이터가 항상 보장되는 경우에는 useSuspenseQuery가 코드도 간결하고 관리하기 편했다.

하지만 반대로 URL Param이나 상위 API의 결과처럼 조건부로 요청을 시작해야 하는 데이터라면 useQuery와 enabled를 사용하는 편이 훨씬 자연스러웠다.

이번 경험을 통해 중요한 것은 어떤 Hook이 더 좋은가가 아니라 서비스에서 데이터가 언제 준비되고 언제 요청되어야 하는지를 먼저 이해하는 것이라는 점을 배웠다.
