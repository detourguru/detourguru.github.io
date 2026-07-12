+++
date = '2026-07-02T23:50:40+09:00'
draft = false
title = 'React Query 최적화 잘못하면 생기는 일'
+++

## React Query로 갈아탔더니 API 요청이 100건 넘게 갔다

`useSuspenseQuery`에서 `enabled` 옵션을 사용할 수 없는 문제를 해결하면서 프로젝트 전체에서 일관된 API 호출 패턴을 만들기 위해 커스텀 래퍼 훅을 만들었다.

```ts
// useSuspenseQuery
useQuery("END_POINTS"); // GET
useMutate("POST", "END_POINTS", body, options);

// useQuery
useConditionalQuery("END_POINT", queryParams, options);
```

엔드포인트를 `END_POINTS` 상수로 관리하고 공통 옵션을 한곳에서 처리할 수 있어서 코드도 훨씬 간결해졌다.

그런데 적용 후 네트워크 탭을 확인해보니 예상치 못한 문제가 생겼다.

- 이미 방문했던 페이지를 다시 열어도 API가 계속 호출된다.
- 게임 생성 버튼을 한 번 눌렀는데 뒤이어 API 요청이 수십건 발생한다.

React Query를 사용하고 있는데도 캐싱이 전혀 동작하지 않는 것처럼 보였다.

## 페이지를 이동할 때마다 API가 29개씩 다시 호출되는 현상

게임 플레이 화면에서 다른 페이지로 이동했다가 다시 돌아올 때마다 약 29개의 API 요청이 발생했다.

서버 데이터가 변경된 것도 아닌데 왜 매번 다시 요청할까?

### 래퍼 훅에 fallback 없음

커스텀 래퍼 훅이 아래와 같이 구현되어 있었다.

```ts
return useReactQuery({
  queryKey,
  queryFn: () => handleData<T>("GET", key, param),
  ...options,
  staleTime: options?.staleTime,
});
```

`options`를 전달하지 않으면 `staleTime`이 `undefined`가 되는데, React Query의 기본 동작은 `staleTime = 0`이다.

즉 다음과 같은 흐름이 만들어졌다.

데이터를 받아오는 즉시 stale 상태가 된다. → `refetchOnMount` 기본값은 `true` → stale 상태에서 컴포넌트가 다시 마운트되면 즉시 refetch한다.

페이지 이동 시에는 컴포넌트가 `unmount → remount` 되므로 이미 캐시에 데이터가 있어도 모든 Query가 다시 실행되고 있었다.

더 큰 문제는 프로젝트의 `QueryClient`에는 이미 전역 staleTime을 10분으로 설정해두었는데 래퍼 훅에서 옵션을 덮어쓰면서 전역 설정을 제대로 활용하지 못하고 있었다는 점이다.

### 래퍼 훅에 fallback 추가

가장 안전한 방법은 래퍼 훅에서 기본값을 강제하지 않고 전역 설정을 그대로 사용하도록 만드는 것이었지만

```ts
return useReactQuery({
  queryKey,
  queryFn: () => handleData<T>("GET", key, param),
  ...options,
});
```

개별적으로 options을 받을 수도 있게 하려고 이렇게 fallback을 추가해줬다.

```ts
staleTime: options?.staleTime ?? Infinity; // Infinity 여도 관련 값 업데이트 되면서 invalidates 처리로 리페치됨
```

결과적으로 페이지를 다시 방문해도 불필요한 API 요청이 발생하지 않게 되었다.

## 뮤테이션 한 번에 API가 109건 호출되는 현상

게임 생성 버튼을 누른 뒤 네트워크 탭을 보니 무려 109개의 요청이 발생했다.

### 쿼리 전역 무효화

기존 코드에서는 성공 콜백마다 아래 코드가 있었다.

```ts
queryClient.invalidateQueries();
```

이 간단해 보이는 코드는 사실 참 무시무시한 코드였다. `인자 없이 호출하면 모든 쿼리를 stale 시킨다.`
실시간성이 강조되는 화면이라 일단 썼는데 엔드포인트가 늘어나며 기술부채가 됐다.

결국 버튼 하나를 눌렀는데 프로젝트에 등록된 모든 Query가 다시 실행되면서 100건이 넘는 요청이 발생하게 되었다.

### 관련 쿼리만 무효화

그래서 변경된 데이터와 관련된 Query만 무효화하도록 수정했다.

```ts
queryClient.invalidateQueries({
  queryKey: ["GAMES"],
});

queryClient.invalidateQueries({
  queryKey: ["MY_GAMES"],
});
```

이 한 줄 수정만으로 재요청은 **109건에서 2건**으로 줄었다.

## 이번에 배운 점

React Query를 쓴다고 자동으로 최적화되는 게 아니다.

작은 설정 하나가 수십~수백 건의 불필요한 API 요청으로 이어졌기 때문에 더욱 주의해야겠다는 생각이 들었다.
그러니까 재요청이 늘어났다 싶을 때는 이 순서로 의심해보면 될 것 같다.

- staleTime을 명시적으로 안 넣었는지 (안 넣으면 기본값 0이라 마운트될 때마다 재요청되니까)
- 커스텀 래퍼 훅을 쓰고 있다면 옵션이 전역 QueryClient 설정을 덮어쓰고 있지 않은지?
- invalidateQueries()를 인자 없이 부르고 있지 않은지!! -> 영향받는 쿼리키만 무효화하는 것이 가장 베스트
