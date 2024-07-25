---
layout: post
title: next.js 프로젝트캠프 9일차
subtitle: 렌더링과 useState, useRef
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [react, rendering, hook, useState, useRef]
author: Detourguru
---

# 조건부 렌더링

- 특정 조건에 따라 다른 결과를 보여준다

## if문

```
const App = () => {
  const isLoggedin = false;

  if (isLoggedin) {
    return <h1>Logged in successfully</h1>;
  }
  return (
    <>
      <h1>Login failed</h1>
    </>
  );
};
export default App;
```

## 삼항연산자

```
const App = () => {
  const isLoggedin = false;

  return <>{isLoggedin ? <h1>success</h1> : <h1>fail</h1>}</>;
};
export default App;
```

## 논리 연산자 (&&)

```
const App = () => {
  const isLoggedin = false;

  return (
    <>
      {isLoggedin && <h1>success</h1>}
      {!isLoggedin && <h1>fail</h1>}
    </>
  );
};
export default App;
```

# 반복 렌더링

- iterable한 데이터의 경우 다음과 같이 반복 렌더링이 가능

```
const App = () => {
  const fruits = ["banana", "apple", "cherry"];
  return (
    <>
      <ul>
        {fruits.map((fruit) => (
          <li>{fruit}</li>
        ))}
      </ul>
    </>
  );
};
export default App;
```

# useState()

- useState 함수는 리액트가 추적 및 관찰 가능한 데이터를 생성한다
- 내부적으로 배열을 반환한다 : `[arg, () => {}]`
- 배열의 요소는 각각 상태값, 상태값을 변경하는 함수이다

```
import { useState } from "react";
const App = () => {
  // 배열 비구조할당 useState(0) == [0, () => {}]
  // 관례적으로 set + 매개변수와 같이 함수명을 지어준다
  let [count, setCount] = useState(0);
  return (
    <>
      <h1>count: {count}</h1>
      <button
        onClick={() => {
          setCount(count++);
        }}
      >
        증가
      </button>
    </>
  );
};
export default App;
```

- 리액트는 메모리에 저장된 값에 변경이 있을 때 batch 업데이트를 해주고, 이때 배치 업데이트를 진행하며 중복된 실행 결과는 한번의 업데이트로 인지하고 처리될 수 있다
- 따라서 함수를 실행하는 시점에 콜백함수를 사용해 항상 최신의 결과가 노출되도록 해줄 수 있다

```
setCount((currentValue) => currentValue + 1);
```

# useRef()

- useRef는 리액트에서 HTML 요소에 접근하거나 컴포넌트의 렌더링에 영향없이 값을 유지하고 싶을 때 사용한다
- useRef는 값에 변조가 이루어지지 않은상태로 참조할 때 사용하기 유용하고, useState는 값에 접근해 최신 값으로 업데이트 하며 추적하여 사용하기 유용하다
- useRef()로 저장된 값은 current로 꺼내서 값에 접근할 수 있다

```
import { useRef, useState } from "react";

const App = () => {
  // 고유한 값을 가지고 있음
  const count = useRef("");
  const [arr, setArr] = useState<string[]>([]);
  const onClickHandler = () => {
    count.current += 1;
    setArr((prev) => [...prev, count.current]);
    return;
  };
  return (
    <>
      <h1>{count.current}</h1>
      <pre>{JSON.stringify(arr)}</pre>
      <button onClick={onClickHandler}>증가</button>
    </>
  );
};
export default App;
```

- ref 속성을 통해 연결된 요소를 참조할 수 있다

```
import { useRef } from "react";

const App = () => {
  const inputEl = useRef<HTMLInputElement>(null);
  return (
    <>
      <h1>App Component</h1>
      <input type="text" ref={inputEl} className="border border-slate-500" />
      <button
        onClick={() => {
          console.log(inputEl.current?.focus()); // ref에 연결된 요소를 참조한다 (query selector로 요소를 찾은 것과 유사함)
        }}
      >
        Focus!
      </button>
    </>
  );
};
export default App;
```

# useId()

- 하나의 컴포넌트 안에서 하나의 고유한 값을 생성해준다
- 컴포넌트 내부에서 반복문으로 고유한 값을 생성할 수는 없지만 (반복문을 돌며 최초 생성된 고유한 값만을 반환), 반복문을 통해 컴포넌트를 생성할 때 각 컴포넌트 내부에서 useId()를 호출하며 매 컴포넌트가 고유한 값을 갖도록 할 수 있다

```
const uuid = useId();
```
