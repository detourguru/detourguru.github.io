---
layout: post
title: next.js 프로젝트캠프 9일차
subtitle: 리액트 상태관리 - useReducer, context API
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [react, useReducer, contextAPI]
author: Detourguru
---

# useReducer

- 함수 안에서 상태를 관리할 수 있도록 하는 훅
- useState()와 유사한 점이 많은데, useStae()는 새로운 상태값을 직접 전달하지만 useReducer()는 reducer 함수를 통해 **상태 변화 로직을 정의하고 새로운 값을 반환**한다. **복잡한 상태관리 로직을 가진 컴포넌트 일 때 효과적**으로 사용할 수 있다.
- reducer 함수의 첫 번째 매개변수인 state는 **항상 이전 상태**이며, 두 번째 매개변수인 action은 dispatch 함수를 통해 전달된 객체이다.
- dispatch 함수를 통해 전달되는 action 객체는 다양한 payload를 전달할 수 있어 **유연성이 높다**

## 예제 코드

```
import { useReducer } from "react";

const App = () => {
  // state와 action을 매개변수로 받는다
  const reducer = (
    state: string,
    action: { type: string; payload: object }
  ) => {
    switch (action.type) {
      case "TOGGLE_THEME":
        return state === "dark" ? "light" : "dark";
      default:
        return state;
    }
  };
  // 각각 현재상태와 상태변경함수(관례적으로 dispatch라고 작성)
  const [theme, dispatch] = useReducer(reducer, "light"); // 초기화값

  return (
    <>
      <h1>현재 테마: {theme}</h1>
      <button
        onClick={() =>
          dispatch({
            type: "TOGGLE_THEME",
            payload: { theme: theme === "light" ? "dark" : "light" },
          })
        }
      >
        모드 바꾸기
      </button>
    </>
  );
};
export default App;

```

# context API

- context: 컴포넌트의 depth가 깊어질 수록 props가 거쳐가는 컨포넌트의 양이 많아지는데, 이러한 props 드릴링을 방지하기 위해 따로 데이터를 공유하기 위한 방식
- 전역적으로 **컴포넌트끼리 데이터를 공유**할 수 있음
- **context의 값이 변경될 때마다 모든 하위 컴포넌트가 리렌더링** 되므로 적절한 메모이제이션과 병용해 불필요한 리렌더링을 줄일 것을 고려해야한다
- Provider: context를 제공 -> 해당 컴포넌트의 태그로 값을 공유할 컴포넌트를 감싸 원하는 컴포넌트에 context를 제공할 수 있다
- Consumer: context를 사용

## 예제 코드

- ThemeContext.tsx

```
import React, { createContext, useReducer } from "react";

// action type 생성
type TThemeAction = { type: string; payload: object };

// createContext함수를 통해 context 생성
// provider value로 넘겨주는 데이터의 타입을 여기에 지정한다
export const ThemeContext = createContext<{
  theme: string;
  dispatch?: React.Dispatch<TThemeAction>;
}>({ theme: "light" }); // 타입을 맞추기 위한 초기화 값

// 상태변경을 위한 reducer 함수
const reducer = (state: string, action: TThemeAction) => {
  switch (action.type) {
    case "TOGGLE_THEME":
      return state === "dark" ? "light" : "dark";
    default:
      return state;
  }
};

// provider
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, dispatch] = useReducer(reducer, "light");

  // 이제 이 provider로 컴포넌트를 감싸주면 value를 공유할 수 있다
  return (
    <ThemeContext.Provider value={{ theme, dispatch }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- App.tsx

```
import AnotherComponent from "./AnotherComponent";
import { ThemeProvider } from "./ThemeContext";

const App = () => {
  return (
    <>
      {/* 데이터를 제공받을 컴포넌트를 provider로 감싸주었다 */}
      <ThemeProvider>
        <AnotherComponent />
      </ThemeProvider>
    </>
  );
};
export default App;
```
