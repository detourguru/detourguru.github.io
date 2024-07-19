---
layout: post
title: next.js 프로젝트캠프 2일차
subtitle: JS (2) - 자료형과 연산자, 조건문과 반복문
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [javaScript]
author: Detourguru
---

## 오늘의 팁

- JS 엔진은 컴파일러 시 코드 끝에 `;`을 자동으로 넣어주고 있다
- `` ` ``: 백틱

# 자료형

> - JavaScript는 동적타입을 지원하는 언어로, 타입을 지정해줄 필요가 없다.
> - 각 자료형은 `typeof` 키워드를 사용해 확인할 수 있다.

    ```
    // 원시 자료형
    let num = 1;
    console.log(typeof num); // number
    ```

> - 변수에 값을 할당하는 방식에 따라 기본 자료형과 참조 자료형으로 나뉜다.

    ```
    // JS는 변수공간에 들어있는 값을 비교하고 있는데,
    // 기본 자료형의 값들은 할당 시 변수공간에 직접 저장되지만
    // 참조 자료형의 값들은 해당 값이 아닌 해당 값이 정의된 메모리공간의 주소가 들어간다.
    const num1 = 10;
    const num2 = 10;
    console.log(num1 === num2); // true
    const arr1 = [10, 20];
    const arr2 = [10, 20];
    console.log(arr1 === arr2); // false
    ```

## 기본 자료형 (원시타입)

- 숫자형: 숫자의 값 (양수, 음수, 정수, 소수, 지수 등)

  ```
  const num1 = 10; // 양수
  const num2 = -10; // 음수
  const num3 = 3.14; // 소수
  const num4 = 10e12; // 지수: 결과값인 10000000000000를 저장함
  ```

- 문자열: 따옴표로 감싸진 값
  ```
  const str = "10";
  ```
- 템플릿 문자열: 백틱으로 문자열을 감싸주고 `${var}` 와 같이 사용할 때 파이썬의 format 함수와 비슷한 역할을 해준다

  ```
  const age = 10;
  const msg = `나는 ${age}살 입니다.`;
  ```

- 논리형: `true`, `false`처럼 참과 거짓을 구분하는 값

  ```
  const bool1 = true;
  const bool2 = false;
  ```

- 특수자료형

  - undefined: 개발자가 아닌 JavaScript 엔진이 다루는 값으로 값이 선언되지 않은 경우의 값이다. 명시적으로 값을 지정하지 않은 경우의 값.

    ```
    let tvChannel; // 초기화 값인 undefined를 js 엔진이 넣어준다
    const test; // 초기화 값을 제공하지 않아 에러를 반환함
    ```

  - null: 개발자가 명시적으로 값이 없음을 나타내기 위해 의도적으로 지정한 값.

    ```
    const movieChannel = null;
    ```

  - NaN: `Not A Number`의 줄임말로, 산술 연산처리를 시도했으나 피연산자가 숫자가 아닐 때 반환되는 값
    ```
    console.log("A" - "B"); // NaN
    ```

- 심볼형: 변수에 `Symbol()`을 할당하면 중복되지 않는 유니크한 값을 생성해준다.

  ```
  // const t = Symbol("이 안에는 주석과 비슷한 기능을 하는 description도 넣어줄 수 있다");

  const a = Symbol();
  const b = Symbol();
  a === b; // false
  ```

## 참조 자료형

- 배열: 여러개의 값을 묶어둔 값

  ```
  const arr = [90, 50, 10];

  // 배열 안의 값을 꺼내올 때는 인덱스로 접근해서 배열 내 원하는 값을 가져올 수 있다.
  console.log(arr[1]); // 50

  // 배열의 길이보다 인덱스값이 크거나 없을 때 undefined를 반환한다
  console.log(arr[4]); // undefined
  ```

- 객체: 여러개의 값을 {키 : 값} 형태로 묶어둔 값.

  ```
  const scoreObj = {
  	korean: 90,
  	english: 50,
  	math: 10
  };

  // 객체 안의 값을 꺼내올 때는 마침표연산자 (.)를 사용해 원하는 값을 가져올 수 있다.
  console.log(scoreObj.korean); // 90

  // 혹은 대괄호 연산자를 사용할 수 있다
  console.log(scoreObj["english"]); // 50
  ```

- 함수: 일련된 코드의 집합 덩어리를 의미한다

  ```
  function func() {
  	// 여기에 실행하고자 하는 코드가 들어간다
  };
  ```

# 연산자

> - 특정한 연산을 처리하기 위해서 사용하는 기호
> - 피연산자란 연산자를 통해 연산되는 값들을 말한다

## 산술 연산자

- 덧셈 (+)

  - 산술 연산자 뿐만 아니라 문자열의 연결 연산자로써 사용되기도 한다

  ```
  console.log(20 + 20); // 40
  console.log("가" + "나다"); // "가나다"
  ```

- 뺄셈 (-)
- 곱셈 (\*)
- 나눗셈 (/)

  ```
   console.log(10 / 3); // 3.333333...
  ```

- 나머지 (%)
  ```
   console.log(10 % 3); // 1
  ```

## 증감 연산자

- 증가연산자: 변수에 할당된 숫자 값을 1 증가시킬 때

  ```
  let num1 = 10;
  num1++;
  num1++;

  console.log(num1); // 12
  ```

- 감소연산자: 변수에 할당된 숫자 값을 1 감소시킬 때

  ```
  let num2 = 10;
  num2--;
  num2--;

  console.log(num2); // 8
  ```

### 전치연산과 후치연산

> 증감연산자를 변수 앞에 쓰면 전치연산, 뒤에쓰면 후치연산이다.

- 전치연산: `~하기 전에`

  ```
  let num3 = 10;
  const result = ++num3; // num3를 result에 할당하기 전에 이미 연산이 이루어짐
  console.log(result); // 11
  ```

- 후치연산: `~한 후에`
  ```
  let num3 = 10;
  const result = num3++; // num3를 result에 할당한 후 연산이 이루어짐
  console.log(result); // 10
  ```

## 대입 연산자

- 복합대입 (+=)

  ```
  let num = 10;
  num += 10; // num = num + 10
  console.log(num); // 20
  ```

- 할당 (=)

## 비교 연산자

- 동등, 부등연산자: 자료형을 암묵적으로 형변환을 해 비교해준다
- 일치, 불일치연산자: 자료형까지 비교한다

  ```
  const num1 = 10;
  const num2 = 10;
  const strNum = "10";

  // 동등연산자
  console.log(num1 == num2); // true
  console.log(num1 == strNum); // true

  // 일치연산자
  console.log(num1 === strNum); // false

  // 부등연산자
  console.log(num1 != num2); // false
  console.log(num1 != strNum); // false

  // 불일치연산자
  console.log(num1 !== strNum); // true
  ```

- 부등호 연산자들 (>, >=, <, <=): 자료형을 암묵적으로 형변환을 해 비교해준다

  ```
  const num1 = 10;
  const num2 = 20;
  const strNum = "20";

  console.log(num1 > num2); // false
  console.log(num1 >= num2); // true
  ```

## 삼항 연산자

- 세 개의 피연산자를 이용해서 값들을 비교하는 연산자

  ```
  const budget = 1000;
  const price = 2000;

  // 피연산자1의 자리에 0, null, undefined가 들어가면 false로 판단한다
  // 0이 아닌 수 (음수도 포함), 문자열, 배열 등일때는 true로 판단한다
  const result = budget > price ? "물건을 구매하겠습니까?" : "돈이 부족합니다";
  console.log(result); // "돈이 부족합니다"
  ```

## 논리 연산자

- and 연산자 (&&): and 연산자로 묶인 피연산자 중 하나라도 거짓이면 거짓이다.
- or 연산자 (||): or 연산자로 묶은 피연산자중 하나라도 참이면 참이다
- not 연산자 (!): 단일 피연산자 논리 값에 반대되는 논리연산자를 반환한다
  - not 연산자를 두번 사용하면 (!!) 논리 값이 아닌 값을 논리 값으로 변환해 반환한다.

# 조건문

- If & Else If & Else: 논리 및 값이 조건일 때

  - 로직이 복잡할 때 조건에 의해 코드가 실행되도록 하는 것이 효율적이다

  ```
  if (논리형데이터1) {
  	// 조건으로 주어진 논리형 데이터가 참일 때에만 여기에 진입
  } else if (논리형데이터2) {
  	// 논리형데이터1이 참이 아닐 때 여기로 진입
  } else if (논리형데이터3) {
  	// 논리형데이터2이 참이 아닐 때 여기로 진입
  }
  ...
  else {
  	// if문 및 else if문을 타지 않는 조건일 때 여기로 진입
  }

  // 조건에 따른 코드가 한줄일 때 중괄호를 사용하지 않을 수 있다
  if (조건) msg = "어쩌고일때"
  else msg = "저쩌고일때"
  ```

- Switch: 값이 조건일 떄

  ```
  const area = "도서산간";
  let shippingFee;

  switch (area) {
  	case "서울":
  		shippingFee = 3000;
  		break;
  	case "부산":
  		shippingFee = 5000;
  		break;
  	case "경기도":
  		shippingFee = 4000;
  		break;
  	case "광주":
  		shippingFee = 3500;
  		break; // break가 없으면 조건에 상관없이 break를 만날때까지 코드를 진전시킨다
  	defalut:
  		shippingFee = 10000;
  		break;
  }
  ```

# 반복문

> 무한 루프에 빠지지 않도록 각별히 주의해야한다

- while

  ```
  while (조건) {
  	// 조건이 참일 때, 조건이 참인 동안 여기의 코드가 반복된다
  }

  ```

- do while

  ```
  do {
  	// 조건이 참이든 거짓이든 최초 1회는 무조건 코드를 실행한다
  } while (조건) // 조건이 참일 때, 조건이 참인 동안 코드를 반복한다

  ```

- for

  - 초기문: 코드가 실행될 때 한번만 실행된다
  - 조건문: forloop가 도는 동안 매번 조건을 검증한다
  - 증감문: forloop가 도는 동안 매번 증감한다

  ```
  for (초기문;조건문;증감문) {
  	// 조건이 참인 동안 여기의 코드가 반복된다
  }
  ```

- for in: 배열이나 객체를 반복할때 사용하는 반복문

  ```
  const arr = ["banana", "apple", "orange"];
  for (let idx in arr) {
    // 배열이나 객체의 길이만큼 반복한다
    console.log(arr[idx]);
  }
  ```

  ```
  const obj = { name: "철수", age: 20 };
  for (let key in obj) {
    // 배열이나 객체의 길이만큼 반복한다
    console.log(obj[key]);
  }
  ```

- for of: 배열에 직접 접근한다

```
const arr = ["banana", "apple", "orange"];
for (let index of arr) {
  console.log(index); // "banana", "apple", "orange"
}
```
