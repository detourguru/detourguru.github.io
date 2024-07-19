---
layout: post
title: next.js 프로젝트캠프 5일차 -1
subtitle: JS (5) - DOM
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [javaScript, DOM]
author: Detourguru
---

# Dom (Document Object Model)

- html 태그를 객체화 한 것으로, js로 접근이 가능하다

## 선택자로 문서 객체 찾을 때

```
// const getH1 = document.getElementById("h1"); // 과거 더 많이 사용하던 방식. 과거에는 상대적으로 더 가벼웠으나 요즘은 유의미한 차이가 없다
const h1 = document.querySelector("h1"); // 요즘은 이 방식을 더 많이 쓴다
const allH1 = document.querySelectorAll("h1");
const specificH1 = document.querySelector(".specific");
```

## innerHTML과 innerText로 컨텐츠 변경

```
specificH1.innerText = "<i>I modified you!</i>"; // text 추가
specificH1.innerHTML = "<i>I modified you!</i>"; // html로 추가

console.log(h1)
console.log(allH1); // 배열로 반환
console.log(specificH1);
```

## 스타일을 변경하기

```
h1.style.color = "blue";
h1.style.background = "black";
h1.style.fontSize = "80px"; // css에서 -으로 구분되던 속성은 카멜케이스로 찾을 수 있다
```

## class

```
// 클래스 추가하기
specificH1.classList.add("active");

// 클래스 삭제하기
specificH1.classList.remove("specific");

// 클래스 토글하기
specificH1.classList.toggle("toggle"); // toggle class 없었기 때문에 추가됨
specificH1.classList.add("toggle"); // 임의로 추가해줌
specificH1.classList.toggle("toggle"); // toggle class 있어서 삭제됨
```

## input value 가져오기

```
setTimeout(() => {
const inputEl = document.querySelector("input");
console.log(inputEl.value);
}, 3000);
```

# Event

> 사용자가 웹 페이지의 특정 요소와 상호작용할 때 발생하는 것

- 1. 이벤트 타겟: 이벤트의 대상이 되는 DOM객체
- 2. 이벤트 타입: 발생한 이벤트의 종류
- 3. 이벤트 핸들러: 이벤트가 발생했을 때 실행할 코드
- 4. 이벤트 등록: 이벤트 타겟에 타입과 핸들러 동작을 연결

```
// 이벤트 타겟
const inputEl = document.querySelector("input");

// 이벤트 타입 & 이벤트 핸들러
inputEl.addEventListener("keydown", () => {
  console.log("keydown 감지");
});
```
