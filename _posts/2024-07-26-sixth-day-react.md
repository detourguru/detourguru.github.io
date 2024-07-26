---
layout: post
title: next.js 프로젝트캠프 10일차
subtitle: 리액트 라우트 관리 및 API 통신
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [react, router, useEffect, API]
author: Detourguru
---

# TIL

- `import {} from "react";` 와 같이 import 할 때 auto import 가 더 용이함
- 아래와 같은 화살표 함수에서

```
// 이렇게 사용해야 함수 내의 로직을 타고 return함
() => set((state) => ({ count: state.count + 1 }))
// 이런식의 사용은 반환되는 데이터가 없어진다
() => set((state) => { count: state.count + 1 })
```

- 객체 내에서 [{key}] 이 문법으로 사용하게 되면 키값을 변수로 받을 수 있다

```
const key = "uname";
const test = {
  [key]: "lucia"
};
console.log(test) // {uname: lucia};

// 이런식으로 동적으로 키값을 할당할 수 있다
const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
  setInput({ ...input, [e.target.name]: e.target.value });
};

```

# zustand: 전역 상태 관리 라이브러리

- tip: 가장 상용화 되어있는 Redux 라이브러리를 별도로 공부하는 것도 도움이 된다
- useState()는 props로 넘겨받아야 컴포넌트에서 해당 값을 사용할 수 있지만, 전역으로 관리되는 값은 넘겨주지 않아도 가져와 사용할 수 있다
- zustand로 관리되는 데이터를 사용하지 않으면 리렌더링도 이루어지지 않는다

```
import { create } from "zustand";

type TCountStore = {
  count: number;
  increment: () => void;
  decrement: () => void;
};
// set 매개변수는 zustand값에 접근하거나 변경할 때 set이라는 함수를 사용한다 (setter의 역할을 함)
// 여기에서 반환되는 상태값이 zustand를 통해 전역으로 관리되는 값이 된다

// 전역으로 관리되는 데이터를 공유받는 컴포넌트에서는 useStore()를 받아 사용할 수 있다
export const useCountStore = create<TCountStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () =>
    // 현재값 state는 현재 zustand에서 관리하는 값들이므로 state.count와 같이 값에 접근할 수 있다
    set((state) => ({
      count: state.count - 1,
    })),
}));
```

# useEffect

- 리액트 컴포넌트의 생성, 업데이트, 제거 되는 시점마다 특정 로직을 수행할 수 있도록 하는 훅

```
import { useEffect, useState } from "react";

const A = () => {
  const [count, setCount] = useState(0);
  // update
  useEffect(() => {
    console.log("변경 될 때 호출됨");
  }, [count]);

  // create
  useEffect(() => {
    console.log("A가 실행될 때 한번만 호출됨");
    const interval = setInterval(() => {
      console.log("a interval");
    }, 1000);

    // delete
    return () => {
      console.log("A가 제거될때 호출됨");
      clearInterval(interval);
    };
  }, []);
  return (
    <>
      <h1>A Component {count}</h1>
      <button onClick={() => setCount((prev) => prev + 1)}>증가</button>
    </>
  );
};

export default A;
```

# API (데이터 통신)

- HTTP(s) 데이터 통신을 위해 내장 메소드를 사용한다:
- GET: 데이터 조회
- POST: 데이터 생성
- PUT: 데이터 수정 (전체 수정: {name: 'test', age: 20} ==> {name: 'test', age: 30})
- PATCH: 데이터 수정 (일부 수정: {name: 'test', age: 20} ==> {age: 20} 만 수정)
- DELETE: 데이터 삭제
- 이외에 OPTIONS, HEAD 메소드도 있다

### JSON-SERVER 패키지: json을 db로 삼아 데이터 조회

- (GET) http://localhost:3000/Lucia => Lucia 객체의 값을 반환
- (GET) http://localhost:3000/Lucia/1 => Lucia 객체의 id가 1인 값을 반환
- (GET) http://localhost:3000/Lucia?key=value => Lucia 객체 내에서 필드명과 일치하는 값을 반환
- (GET) http://localhost:3000/Lucia?key_like=value => Lucia 객체 내에서 필드명에 값이 포함된 값을 보여줌
- (GET) http://localhost:3000/Lucia?key_ne=value => Lucia 객체 내에서 필드명에 값이 포함되지 않은 값을 보여줌

## : react router: 리액트 route 관리 패키지

- Routes 태그 안에 Route 태그 속성으로 경로를 주어 라우트를 관리할 수 있다

```
import React from "react";
import ReactDOM from "react-dom/client";
// import "./assets/css/index.css";

import { RouterProvider } from "react-router-dom";
import { router } from "./router";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 이 태그 안의 컴포넌트들은 주소관리가 된다: react-dom 라이브러리 활용 */}
    <RouterProvider router={router} />
  </React.StrictMode>
);
```

- `<Link/>`: html의 a태그처럼 사용이 가능함. href 대신 to를 사용

```
import { Link, Route, Routes } from "react-router-dom";
import Write from "./pages/Write";
import About from "./pages/About";
import Home from "./pages/Home";

const App = () => {
  return (
    <>
      <ul>
        <li>
          <Link to="/home">home</Link>
          <Link to="/about">about</Link>
          <Link to="/write">write</Link>
        </li>
      </ul>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/write" element={<Write />} />
      </Routes>
    </>
  );
};
export default App;
```

- 동적 라우팅 (dynamic routing)

```
// app.tsx
<Route path="/detail/:id" element={<Detail />} />

// detail component
import { useParams } from "react-router-dom";

const Detail = () => {
  const params = useParams(); // 파라미터 받아오기
  const [searchParams] = useSearchParams(); // 쿼리스트링 받아오기
  return (
    <>
      <h1>Detail {params.id} Component</h1>
      <h2>{searchParams.get("title")}</h2>
    </>
  );
};
export default Detail;
```

# 실습: 블로그 만들기

## debounce

- 사용자가 입력을 특정 시간 이상 멈출 때까지 기다리도록 해 요청 수를 줄이는 방식

```
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("거색중");

      fetchPosts(`/posts?title_like=${keyword}`);
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, [keyword]);
```
