---
layout: post
title: next.js 프로젝트캠프 11일차
subtitle: nextjs의 렌더링과 라우트
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [nextJS, route]
author: Detourguru
---

# next js

## 렌더링

- 가장 정적인 html 화면을 먼저 렌더링해준 후 (repaint, reflow) 동적 코드인 js을 별도로 불러오는 하이드레이션 과정을 한다. 한번에 해야하는 작업을 두번으로 나누어 렌더링을 일으키는 셈인데, 이때 비용이 상대적으로 덜 발생한다.
- 하이드레이션: 정적 페이지에 수분을 공급하듯이 스크립트 코드를 공급한다는 의미임. 서버에서 렌더링한 페이지에 스크립트 코드를 넣어 웹 페이지를 동적으로 처리
- ssr(서버사이드 렌더링): ssr이 적용된 사이트임을 확인은 네트워크 탭에서 응답받은 데이터에 js가 실행되기도 전에 페이지가 완전히 보여지고 있다
- seo: 검색엔진 검색 최적화 / html 마크업을 적절하게 사용하였는지 등, 웹표준을 준수하는지 등. light house 탭에서 벤치마킹 점수로 seo 최적화 점수를 확인할 수 있다

## 프레임워크와 라이브러리

- 프레임워크는 주도권이 프레임워크에게 있음. 프레임워크의 규칙에 따라 코드를 작성해야함
- 라이브러리는 우리가 가져다가 사용하는 도구에 가까움

## Route

- 객체로 라우트를 관리했던 리액트와 달리 nextjs는 폴더 경로를 라우트 정보로 사용한다
- app/{path}/page.tsx 경로로 파일을 생성 후 www.url.com/{path}로 접근을 할 수 있음
- 동적 경로: 폴더 경로 내의 동적으로 관리되어야할 세그먼트에 해당하는 부분에 `[path]`와 같은 형태로 넣으면 `www.test.com/path1/{dynamic-path}`와 같이 접근 할 수 있다
- 포괄적 경로: `path/[...slug]`와 같이 접근 시 `path`아래로 어떤 url이 주어지든 포괄적으로 상관 없이 접근할 수 있다
- 폴더 그룹: 폴더 명에 소괄호 () 포함시 경로로 인식되지 않아 그룹으로써 관리가 가능해진다
- 프라이빗 폴더: 폴더 명에 언더스코어 (\_) 를 붙이면 라우팅을 통해 접근할 수 없어짐

# client component

- nextjs는 기본적으로 서버사이드 코드이기 때문에 최상단에 **use client**을 붙여준 파일에 한해서만 클라이언트 사이드 코드로 기능할 수 있다
- 클라이언트 컴포넌트에서는 props를 따로 전달 받지 않고 useParams와 같은 훅 사용이 가능하다
