+++
date = '2026-08-03T19:45:47+09:00'
draft = false
title = 'sentry 캡처도 역할 분리가 필요하다'
description = 'Sentry를 붙였는데 특정 API 실패가 잡히지 않았다. throw하지 않는 REST 래퍼가 만든 사각지대를 찾은 기록.'
tags = ["에러 처리", "디버깅"]
+++

Sentry를 붙이고 나면 뭔가 마음이 편해지는 건 나만 그런가? 렌더링 크래시 이벤트 몇 개가 대시보드에 찍히는 걸 보고 나면 이제 모든 에러를 다 볼 수 있겠지 싶어진다. 그런데 며칠 뒤에 특정 API가 계속 실패한다는 제보를 받고 자신만만하게 대시보드를 열었더니 API 호출 실패 이벤트가 하나도 없었다.

원인은 REST 래퍼였다. 우리 팀의 공통 통신 모듈인 `apiRequest`는 어떤 실패든 `throw`하지 않고 `{ data, error }`를 정상 `return`하도록 짜여 있다. 화면이 깨지지 않게 해서 UX를 지키려는 목적이었다.

```ts
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    return { data: { data: [] }, error: errorText }; // 4xx/5xx도 정상 return해서 화면이 깨지지 않게 하고 대신 error 메시지를 렌더링해준다
  }
  return { data: await response.json() };
} catch (error) {
  console.error(error); // 네트워크 단절은 여기서 콘솔에만
  return { data: { data: [] }, error }; // reject 없이 정상 return
}
```

`throw`가 없으니 전역 unhandled 핸들러도, React ErrorBoundary도, React Query의 `onError`/`retry`도 발동하지 않는다. 실패가 함수 안에서 값으로 바뀌어서 정상적으로 나가는 구조다 보니 어디에도 걸리지 않는 게 당연했다. 이런 구조적 사각지대 때문에 API 실패가 로그에 안 찍혔던 거다.

## API 에러 말고 API 요청 전의 에러를 잡자

그럼 5xx든 4xx든 네트워크 에러든 싹 다 모니터링으로 보내면 안 될까? 근데 그래버리면 생기는 또 다른 이슈가 있었다. 백엔드도 이미 별도로 에러 모니터링을 붙여뒀고, 무료 플랜이라 단독 org라 백엔드 이벤트랑 연결도 안 됐다. 그럼 그냥 `500 떴어요~` 하고 알려주는 알림 외에는 디버깅도 못 하는 진단 가치 없는 이벤트가 될 뿐이었다.

그래서 내린 결론. 프론트가 잡았을 때 의미가 있는 건 요청이 서버에 도달조차 못 한 경우다! 망이 끊기거나 타임아웃이 났거나 응답은 200인데 body가 깨져있거나... 이런 건 서버에서 에러로 잡히지 않으니까.

## 같은 엔드포인트끼리 이벤트를 묶자

처음엔 `tags: { endpoint }`에 원본 endpoint를 그대로 넣어서 보냈다. 그런데 이 프로젝트의 endpoint는 `url/path/{id}?{queryString}` 형태였다. 이게 태그로 그대로 들어가다 보니 모니터링 태그의 카테고리가 id, 심지어는 쿼리스트링마다 고유하게 생겨버리는 바람에 검색과 집계가 망가져버렸다.

이 부분은 `endpoint.split('?')[0]`로 쿼리 부분만 잘라내는 걸로 고쳤다. 아 그리고 body는 개인정보를 포함할 수 있어서 태그에 그대로 넣으면 안 된다. body를 꼭 확인해야 할 필요가 있는 부분은 Sentry 마스킹을 추가해서 태그에 포함시켰다.

## 뭐가 캡처되고 뭐가 안 되는지 테스트로 박아두자

주석이나 문서로 작성해두는 것보다는 테스트로 고정해두는 게 제일 명확하고, 어디에 구멍이 났는지 가장 먼저 확인할 수 있을 것 같아 테스트 코드로 케이스들을 작성해뒀다.

```ts
// 네트워크 단절 -> 캡처됨
vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Failed to fetch"));
await GET("auth/current");
expect(captureException).toHaveBeenCalledTimes(1);

// 서버 500 -> 캡처 안 함 (백엔드 담당)
vi.mocked(global.fetch).mockResolvedValueOnce(
  mockResponse("err", { ok: false, status: 500 }),
);
await GET("auth/current");
expect(captureException).not.toHaveBeenCalled();

// 정상 200 -> 캡처 안 함
vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse({ result: [] }));
await GET("auth/current");
expect(captureException).not.toHaveBeenCalled();
```

## 배운점

아직 에러 모니터링을 API 쪽에만 붙였는데 오히려 에러를 다 잡아보겠다고 덤비는 것보다 이렇게 작은 스코프부터 시작하는 게 시행착오 줄이기엔 좋은 것 같다. 어차피 무료 플랜 써야 하는데 프론트에서 중복 캡처로 낭비할 일도 없었고, 일단 다 남기자!! 보다는 현상 재현이 안 돼서 디버깅이 어려웠던 부분들에 일부 적용하고 실제 지표로 대조해가며 디버깅하니까 편했다. [운영 서버가 npm run dev로 돌고있었다](https://detourguru.github.io/posts/dev-server-as-production/) 에러처럼 특정 환경에서만 발생하는 문제를 잡을 때에도 특히 매우 유용하게 사용했다.

솔직히 쿼리스트링만 잘라냈지 path에 남은 id는 그대로라 엔드포인트 태그를 완전 깨끗하게 관리하고 있는 건 아니다. 그래도 이 정도로도 필요한 만큼 현상을 확인하기에 큰 도움이 됐다. 더 낮은 수준의 cardinality가 필요해지면 id를 `/{id}`로 정규화하거나 `extra` 필드로 옮기는 게 다음 단계일 것 같다.

에러 모니터링은 어디에 딱 붙인다고 모든 에러를 다 캡처하진 못한다. 대신 개발자가 누가 뭘 잡을지 결정해줄 수 있을 때 가장 유용하게 쓸 수 있는 것 같다.

## 참고 자료

- [Sentry — `captureException`](https://docs.sentry.io/platforms/javascript/usage/)
- [Sentry — Filtering Events](https://docs.sentry.io/platforms/javascript/configuration/filtering/)
- [Vitest — esbuild 기반 트랜스파일](https://vitest.dev/guide/features.html)
