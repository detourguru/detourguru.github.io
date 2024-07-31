---
layout: post
title: next.js 프로젝트캠프 12일차
subtitle: nextjs의 시스템파일과 cache, opt-out
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [nextJS, cache]
author: Detourguru
---

# 시스템파일

## page.tsx

- 라우트 경로 지정시 사용

## layout.tsx

- 각 라우트 경로에서 공통된 레이아웃을 지정할 때 사용

### metadata

- 하위 컴포넌트에서 호출해 정의할 때 상위 컴포넌트의 해당하는 속성을 덮어씌운다

## not-found.tsx

- 404 등 경로를 찾지 못했을 때 보여질 커스텀 컴포넌트

## error.tsx

- 500 등 서버 에러가 throw 되었을 때 보여질 커스텀 컴포넌트

## loading.tsx

- 비동기로 데이터를 페칭해오는 로딩시간동안 보여질 커스텀 컴포넌트

# CSR과 SSR

## CSR

- 클라이언트 사이드 렌더링
- 사용자정의 인터랙션 훅을 사용할 수 있다 (use...())

## SSR

- 서버 사이드 렌더링
- fetch, axios와 같은 데이터 통신이 이루어지는 컴포넌트
- csr에 비해 내부 캐싱이 되기 때문에 재요청시 응답이 빠르다

# Suspense

- 비동기 작업이 완료될 때까지 ui 렌더링을 일시 중지하고 옵션으로 주어진 fallback ui를 보여주는 기능이다
- 비동기작업을 기다릴 컴포넌트를 태그로 감싸고 사용하면 된다
- 이때 컴포넌트 내에 비동기 작업이 일어나야한다

```
<Suspense fallback={<div className={"red"}>Loading...</div>}>
    <MyComponent />
</Suspense>
```

# 캐시

- 캐싱 우선순위는 router > full route> request memo > data cache 순이기 때문에 하위 캐싱 순위에서 옵트아웃을 주더라도 캐싱 우선순위에서 캐싱이 되어있어 데이터를 실시간으로 받아오지 못할 수도 있다

## router cache

- 새로고침시 지워지며, Link와 같은 컴포넌트로 세그먼트 이동 시 캐싱이 자동 적용된다
- 자동 무효화: 특정 시간 이후 지워진다 (prefetch가 null일 땐 default: 30s)
- server component > javascript 단계에서 캐싱을 하기 때문에 server component에서의 결과 데이터만 캐싱하며, 클라이언트 컴포넌트에서는 캐시하지 않는다
- 브라우저에 캐싱을 저장 --> 저장시간이 짧다
- 정적, 동적 데이터를 모두 캐싱함

## full route cache

- 자동 정적 최적화, 정적 렌더링
- **빌드했을때** 어떤 파일을 캐싱할지 결정되는 캐싱시스템 (정적인 파일을 캐싱함)
- 캐싱 당시에 캐싱된 데이터가 저장된 페이지만을 확인할 수 있다 (옵트아웃과 같은 캐싱 무효화 코드가 없을 경우)

```
export const revalidate = 0;
```

- 서버에 캐싱을 저장 --> 저장시간이 길다

## request memoization

- 동일한 요청이 여러번 발생하는 것을 방지하기 위해 요청을 메모이제이션 (캐싱)한다
- 새로고침을 하면 휘발된다

## data cache

- 메모이제이션 당시 API 통신을 캐싱해둔다
- 초기화하지 않으면 새로고침을 해도 휘발되지 않고 남아있음

## 옵트아웃

- 캐싱을 무효화함을 개발자가 요청하는 코드
- fetch() 함수에서 두번째 매개변수로 `cache: "no-cache"` 옵션으로 옵트아웃을 주면 캐싱되지 않은 실시간 데이터를 가져올 수 있다
- fetch() 함수에서 두번째 매개변수로 `next: { revalidate: 3600 }`옵션을 주면 특정 시간마다 캐싱을 초기화할 수 있다
- 컴포넌트 내에서 `export const dynamic = "force-dynamic";`을 주었을 때 바로 값이 변경됨을 감지하고 캐싱을 초기화할 수 있다
