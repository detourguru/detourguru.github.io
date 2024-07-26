---
layout: post
title: next.js 프로젝트캠프 6일차
subtitle: ES06 문법과 React 컴포넌트
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [react, ES06, Components]
author: Detourguru
---

# TIL

- JSX(JavaScript XML): js의 확장 문법으로 JS + HTML 과 같은 문법 사용이 가능함
- package.json: 개발 환경에 대한 정보가 여기에 들어있다. script 객체 내의 스크립트를 가지고 실행한다.

# ES06 문법

## 비구조화 할당

- 비구조화 할당은 객체나 배열을 할당할 때 사용할 수 있는 문법이다

### 배열 할당

```
const likeFoods = ['apple' ,'banana', 'orange'];
const [food1, food2, food3] = likeFoods;
console.log(food1, food2, food3); // 각각 변수에 배열의 요소 값 할당 가능
```

### 객체 할당

```
// name 매개변수를 uu라는 alisas(별칭)을 주어 함수 내부에서 uu라는 변수명으로 할당이 가능함
const printHello = ({ name: uu, age }) => `${uu}은 ${age}세 이다.`;
console.log(printHello({ name: "채연", age: 29 }));

const {
    animalName: an,
    animalType,
    ...rest // spread 연산자를 사용해 할당하고 남은 데이터를 한번에 object로 받을 수 있음
    } = {
    animalName: "황도",
    animalType: "고양이",
    animalAge: 20,
    animalGender: "male",
};

console.log(rest);
```

## speard 연산자

```
// 얕은 복사 (shallow copy)
const arr1 = [10, 20, 30];
const arr2 = arr1;

console.log(arr1 === arr2); // 참조 자료형은 기본적으로 얕은 복사가 되어 같은 주소 값을 가지므로 true를 반환
arr1.push(40); // arr1에 요소 추가
console.log(arr2); // arr2에도 동일한 값이 추가된다

// 깊은 복사 (deep copy)
const arr3 = [10, 20, 30];
const arr4 = [...arr3]; // sperad 연산자를 사용해 배열 안의 요소를 가져온다
arr3.push(40);
console.log(arr4);

// spread 연산자를 사용해서 객체나 배열의 요소를 깊은 복사 할 수 있음
// 배열
const arr1 = [10, 20];
const arr2 = [30, 40];

const comb1 = arr.concat(arr2);
const comb2 = [...arr1, ...arr2];

// 객체
const obj1 = {name: "test1", age: 10};
const obj2 = {name: "test2", age: 20};

const comb3 = {...obj1, ...obj2};
console.log(comb3); // 객체 내 중복된 키 값이 있으므로 obj1는 obj2로 덮어씌워질 수 있으니 주의가 필요함
```

# Critical Rendering Path (CRP)

## 렌더링

- 웹 브라우저가 HTML, CSS, JavaScript 코드를 해석하고 화면에 표시하는 과정

## 화면 렌더링 단계

1. HTML, JS, CS 코드 파싱
2. DOM & CSSOM: 코드를 기반으로 웹페이지의 구조를 나타내는 DOM과 CSSOM 생성
3. render tree: 화면에 표시될 각 요소와 그 관계, 스타일 정보 등이 생성
4. layout: 화면에 표시될 각 요소의 실제 위치 및 크기가 계산
5. paint: 계산된 위치와 크기에 따라 각 요소가 화면에 표시

## 렌더링 최적화

- DOM이나 CSSOM 생성 시마다 렌더링과 레이아웃 계산이 다시 이루어지기 때문에 태그나 스타일 생성 회수를 최소화 할 경우 렌더링에 필요한 시간을 최적화 할 수 있다.
- 리액트와 같은 프레임워크에서는 가상 돔 (virtual DOM) 알고리즘을 통해 이러한 단계를 자동으로 대체해주고 있으므로 효율적이다.

## Virtual DOM

- 기존 DOM 요소는 변경이 이루어질 때마다 전체 DOM을 reflow, repaint 과정을 거쳐 재랜더링을 해주어야 했는데, 가상 돔의 경우에는 **변경이 이루어진 부분의 변경사항만을 반영** 후 화면에 렌더링해준다.
- 실제 DOM과 달리 **메모리 상에만 존재**하기 때문에 렌더링이 훨씬 빠르게 이루어질 수 있다
- Diffing (변경 감지): 원본 DOM에서 변경을 감지하고 처리
- Reconciliation (재조정): Diffing을 통해 파악된 변경사항을 원본 DOM에 적용한다.

# React 컴포넌트

## import와 export

- 컴포넌트 내에서 export function을 해주면 다른 컴포넌트 내에서 import 받아 해당 함수를 사용할 수 있다.

```
// 컴포넌트 최상단에서 다음과 같이 import 할 수있다
import App from "./App.tsx";

// 컴포넌트 최하단에 다음과 같이 export 해준다
export default App;

// 위와같이 export defalut를 해주지 않을 거라면 컴포넌트 최상단에서는 다음과 같이 비구조화 할당 방식으로 import 할 수 있다
import { App } from "./App.tsx";
```

## createElement

- createElement(태그명, 속성(nullable), innerHtml)

## JSX

- 리액트의 빠른 전파에 큰 도움을 준 문법
- `(<></>)`: 여러줄의 코드를 작성할 때 이와같이 빈 태그 + 소괄호로 감싸 태그 전체를 묶어주는 역할을 한다

```
import React from "react";

const App = () => {
  return (
    <React.Fragment> // React.Fragment 대신 빈 태그 <> 를 사용해도 된다
      <h1>App component</h1>
      <p>Hello, P Tag!</p>
    </React.Fragment>
  );
};

export default App;
```

- 태그는 항상 닫아주어야함

```
<br/>
<hr/>
```

- `{}` 중괄호로 표현식 사용이 가능함

```
const App = () => {
    return (
        <>
            <h1>count: {10*2}</h1>
        </>
    )
}
```

- 함수형 컴포넌트 이름은 항상 대문자로 시작해야한다 (파스칼 케이스)
- class를 줄 때는 `className`으로 지정해야함

# css

- css파일은 어느 컴포넌트에 import 하더라도 전역적으로 적용되지만, 관례적으로는 `main.tsx`에서 import 하도록 한다

- 모듈식 적용: 특정 컴포넌트에 적용할 css 파일명에는 관례적으로 `{컴포넌트_이름}.module.css`라는 파일명을 사용하고 있음

```
// .css
.title {
    color: blue;
}

// 특정 컴포넌트에 적용하는 모듈 방식 css 스타일
<h1 className={styles.title}>나는 파란글씨</h1>
```
