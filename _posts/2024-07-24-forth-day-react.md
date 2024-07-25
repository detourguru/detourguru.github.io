---
layout: post
title: next.js 프로젝트캠프 9일차
subtitle: 리액트의 불변성, 메모이제이션, 렌더링 최적화
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [react, immutability, memoization, optimization]
author: Detourguru
---

# TIL

- map, filter는 수행 결과로 새로운 배열을 만들어주는 내장 메서드이다

# 리액트의 불변성

- 리액트에서는 데이터 변경 시 직접 접근해 수정하는 것이 아니라 새롭게 데이터를 생성하고, 업데이트한다
- 참조값이 서로 다른 데이터를 생성한 후 접근해야 리액트에서 변경을 감지 후 재렌더링을 일으킨다
- 같은 주소값일 경우 리액트에서는 변경을 감지하지 않는다

```
// 불변성을 위반한 코드
import { useState } from "react";

const App = () => {
  const [count, setCount] = useState({ num: 0 });
  const increment = () => {
    count.num += 1; // 참조자료형 count을 전달받아 num에 접근해 update
    console.log(count);
    setCount(count); // count.num에 변조를 시도했지만 이는 불변성을 위반한 것이다. 실제로 넘어간 값은 넘겨받은 참조자료형 count 그대로이므로 주소값이 동일해 변조를 감지하지 못함
    // setCount({num: count.num + 1}); // {num: count.num +1} 이라는 새로운 객체를 생성해 넘겨주도록 하면 리액트가 정상적으로 변조를 감지하고 재렌더링을 수행한다
  };
  return (
    <>
      <h1>count: {count.num}</h1>
      <button onClick={increment}>증가</button>
    </>
  );
};
export default App;
```

# rendering 최적화

- react는 useState값이 변경되면 (관찰, 추적중이던 데이터에 변조가 일어나면) 컴포넌트의 리렌더링을 수행한다.
- 이때 변조가 일어난 컴포넌트로부터 하위 컴포넌트까지 모두 리렌더링이 일어난다
- 변경이 필요한 컴포넌트 내에서만 렌더링이 일어날 수 있도록 작업하는 것이 성능상 유리하다

```
// 이와 같은 코드에선 A에서 버튼을 눌러 setCount 함수를 실행할 경우 A와 C 모두 렌더링이 일어난다
import { useState } from "react";
import C from "./C";

const A = () => {
  const [count, setCount] = useState(0);
  console.log("a가 렌더링 됨");
  return (
    <>
      <h1>A Component: {count}</h1>
      <button onClick={() => setCount((prev) => prev + 1)}>A에서 증가</button>
      <C />
    </>
  );
};
export default A;
```

# 메모이제이션

- 함수 내에 비용이 많이 발생하는 코드가 정의 되어있다면 성능 저하로 이어질 수 있다
- 그래서 특정 데이터나 값을 기억해두는 방식으로 작업을 하게 됨
- 단, 메모리에 올리는 작업 자체가 비용이 발생할 수 있으므로, 반복문과 같이 반복적으로 수행, 출력되는 것들에 대해서 메모이제이션을 사용하는 등 고민이 필요하다.

## useCallback

- 함수를 저장할 때 사용하는 메모이제이션
- useCallback 내에서 항상 최신값을 참조하는 콜백함수 형태로 값을 update하지 않는다면 useCallback을 사용한 시점의 데이터로 값이 저장되어버리기 때문에 주의해서 사용해야함

```
  // useCallback(() => {기억해야하는값}, [초기화값])
  const increment = useCallback(() => {
    // 이전 값을 참조하는 코드
    setCount((prev) => prev + 1);
    // 이전 값을 참조하지 못하는 코드
    setCount(count+ 1);
  }, []);
```

- 무의미한 메모이제이션 함수를 사용하지 않도록 주의해야함

```
// 초기화 값에 의해 매번 새로운 값을 참조하게 되므로 메모이제이션의 의미가 없어짐
  const increment = useCallback(() => {
    setCount(count + 1);
  }, [count]);

```

- 초기화 값으로 다른 값을 받았을 때 다른 값에 의해 저장된 값이 변경되도록 사용할 수 있다

```
  const increment = useCallback(() => {
    setCount(count + 1);
  }, [count2]);

  functionSet.add(increment);
  console.log(functionSet);

  return (
    <>
      <h1>App Component: {count}</h1>
      <button onClick={increment}>클릭</button>
      <h1>App Component: {count2}</h1>
      <button onClick={() => setCount2((prev) => prev + 1)}>클릭</button>
    </>
  )
```

## useMemo

- 값을 저장할 때 사용하는 메모이제이션
- 리렌더링이 이루어질 때마다 동일한 계산이 이루어지므로 성능상 낭비이다
- 동일한 계산의 반복수행을 제거할 용도로 useMemo를 사용할 수 있다
- 첫번째 함수에서 반환되는 값을 초기화 값이 변경될 때까지 저장한다

```
import { useMemo, useState } from "react";

const initialItems = new Array(29_999_999).fill(0).map((_, i) => {
  return {
    id: i,
    selected: i === 29_999_998,
  };
});

const App = () => {
  const [items, setItems] = useState(initialItems);
  const [count, setCount] = useState(0);
  // 매번 연산하는 코드
  const selectedItem = items.find((item) => item.selected);
  // 메모이제이션
  const selectedItem = useMemo(
    () =>
      // 첫번째 함수에서 반환하는 값을 메모이제이션한다
      items.find((item) => item.selected),
    []
  ); // ~초기화 값이 변경될 때까지
  return (
    <>
      <h1>App Component: {count}</h1>
      <button onClick={() => setCount((prev) => prev + 1)}>증가</button>
      <h1>{selectedItem?.id}</h1>
    </>
  );
};
export default App;
```

# React.memo(component)

- 컴포넌트를 메모이제이션 할때 사용하는 메모이제이션
- export할 때 `React.memo(component)`와 같이 사용할 수 있다

```
export default React.memo(B);
```

- 전달받은 props의 값이 변경될 때까지 메모리에 컴포넌트가 저장된다

```
import React, { useState } from "react";

const B = ({ acnt }: { acnt: number }) => {
  const [count, setCount] = useState(0);
  console.log(`b가 렌더링 됨 ${count}`);
  return (
    <>
      <h1>B Component: {count}</h1>
      <h2>A count: {acnt}</h2>
      <button onClick={() => setCount((prev) => prev + 1)}>B에서 증가</button>
    </>
  );
};
export default React.memo(B); // 메모이제이션 했지만 app 컴포넌트에서 넘겨받은 acnt가 변경될 경우 그때 다시 메모이제이션된다
```

## 면접 단골 질문~

- Q: useMemo와 React.memo()의 차이
  - 값을 메모이제이션 해서 복잡하고 불필요한 계산을 방지 하느냐, 컴포넌트를 메모이제이션 해서 props가 변경되지 않았을 때 재렌더링을 방지 하느냐의 차이이다
- Q: useCallback, useMemo의 차이?
  - 함수를 메모이제이션해서 부모 컴포넌트에서 재렌더링이 일어날 때 자식컴포넌트에 넘겨지는 함수의 참조가 변경되지 않도록 해 재렌더링이 일어날 필요 없도록 최적화 하느냐, 값을 메모이제이션 해서 불필요한 계산을 방지 하느냐의 차이이다
- Q: 고차 컴포넌트가 뭔지 아시나요?
  - 컴포넌트 인자로 받아 메모이제이션 기능이 추가된 새로운 컴포넌트를 반환하는 함수 (예: React.memo())
