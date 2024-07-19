---
layout: post
title: next.js 프로젝트캠프 5일차
subtitle: TS - typeScript 기초
cover-img: /assets/img/nextjs.png
thumbnail-img: /assets/img/nextjs.png
share-img: /assets/img/
tags: [typeScript]
author: Detourguru
---

# typeScript

## 자료형

```
// 기본자료형
const num: number = 10; // 숫자
const str: string = "hello"; // 문자
const bool: boolean = true; // 논리형
const nul: null = null;
const und: undefined = undefined;

// 참조자료형
const obj: object = {}; // 객체
const arr: [] = []; // 배열
const func: Function = () => {}; // 함수: 매개변수에 타입을 명시해줄 것을 권장함
```

## 타입추론

- 타입스크립트가 해당 변수의 타입을 추론하는 방법
- 변수 선언 시 타입을 명시하지 않아도 ts는 할당된 값을 통해 타입을 추론한다
- 따라서 js와 달리 변수에 값을 할당한 이후에는 다른 타입을 재할당 할 수 없다

```
// let msg: string = "Hello World!";
let msg = "Hello World!";
// msg = 10; --> 안됨


// 매개변수에서 받을 때 타입을 명시
const sum = (a: number, b: number): string => {
  return `${a + b}가 답이다.`;
};

// 변수에서 타입을 명시
const sum2: (a: number, b: number) => string = (a, b) => {
  return `${a + b}가 답이다.`;
};

console.log(sum(1, 2));
```

## 타입명시

- 변수선언시 변수명 뒤에 콜론을 붙이고 타입을 명시하는 방법

```
// 명시적으로 타입을 명시할 때
const num: number = 10;
let str: string = "10";

str = new String("10"); // 이때 타입 string과 String이 달라 에러가 발생

// 배열의 타입명시
const arr2: [number, string, number] = [1, "a", 3]; // tuple
const arr3: (number | string)[] = [1, "a", 3]; // union: 배열 안에 number or string이 들어간다

// 객체의 타입명시
const obj1: {} = {};
const obj2: { name: string; age: number } = { name: "kim", age: 10 };
```

### 리터럴 타입

- string 타입이나 number 타입을 엄격하게 지정하는 타입
- 특정 타입을 받을 때 사용
  - 타입을 10|30 이라고 지정했을 때, 10과 30이라는 값만 받을 수 있다기보다는 10과 30이라는 **타입을 받을 수 있는 것**으로 이해해야한다.

```
let num: 10 | 30 = 10;
num = 20; // 에러 발생
num = 30; // 정상적으로 재할당 가능

// string type
const obj = {
    name: "kim:
}

const printName = (name: "kim") => {
    console.log(name);
}

printName("kim"); // 에러 안남
printName(obj.name); // obj.name의 타입은 string이므로 에러 남!

// 방법 1: as const 추가
const obj = {
    name: "kim:
} as const;

// 방법 2: 타입 "kim"으로 지정
const obj: {name: "kim"} = {
    name: "kim"
}
```

## 타입 오퍼레이터

> 타입을 조작하는 연산자

### 유니온 타입 (|)

- or 연산자 (|)를 사용해 여러 타입 중 하나를 선택

```
const arr3: (number | string)[] = [1, "a", 3]; // union: 배열 안에 number or string이 들어간다
```

### 인터섹션 타입 (&)

- and 연산자 (&)를 사용해 여러 타입을 조합

```
const obj: {name: string} & {age: number} = {
    name: "kim":,
    age: 1,
}
```

## 인터페이스

- 객체의 타입을 정의하는 방법
- 객체 내 속성이 많을 수록 타입명시가 길어질 수밖에 없기 때문에 인터페이스를 사용하면 명료하게 정리가 가능하다
- 관례적으로 인터페이스 명 앞에는 대문자 **I**를 붙인다

### readonly property

- 해당 속성을 가지면 외부에서 변경하지 못하는 값이 된다

### optional property

- 키 값 뒤에 **?** 를 붙이면 선택 속성이 된다

### 인덱스 시그니처

- 속성이 명확하지 않다는 단점이 있지만 타입에 따라 유연한 사용이 가능하다

```
interface IUser {
    name: string;
    readonly gender: string; // 외부에서 변경 못함
    height?: number // 선택적으로 가지는 속성
}

// 동일 이름으로 인터페이스 정의 시 동일한 이름의 인터페이스끼리 병합이 된다
interface IUser {
    age: number;
}

// 인터페이스끼리 상속도 가능하다
interface IJob extends IUser {
    title: string;
}

// 인덱스 시그니처: 키의 타입과 값의 타입을 가지고 인터페이스를 만들 수도 있다
interface ISignature {
    [key: string]: string | number;
}

const obj: IUser {
  name: "kim",
  age: 20,
  gender: "female",
  height: 168,
};
```

## 타입 별칭

- 새로운 타입을 정의하는 방법
- 객체가 아닌 타입을 정리할때는 타입별칭으로 정리가 유용함 / 객체의 경우 인터페이스를 권장
- 인터페이스에 비해 툴팁을 활용하기도 좋아서 타입을 사용하는 것이 유리한 경우가 많다!

```
// 개발자가 정의한 새로운 타입
type TRainbowColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

const phoneColor: TRainbowColor = "yellow";

type TUseStatus = "Y" | "N";
let userYn: TUseStatus = "Y";

// 상속을 지원하지 않으나 인터섹션 타입을 통해 상속처럼 구현이 가능
// 하지만 mouseover로 타입의 속성을 볼 수는 없다
type TColorAndStatus = TRainbowColor & TUseStatus;
```

## Generic

- 타입을 미리 지정하지 않고 사용 시점에 타입을 정의해서 사용할 수 있는 문법
- 타입의 공통 처리가 가능해지므로 확장성이 좋아진다는 이점이 있다

```
// 매개변수나 반환 값의 타입 경우의 수가 많아질수록 타입을 길게 명시해주어야 한다
// function firstElements(
//   elements: (number | string | boolean)[]
// ): number | string | boolean {
//   return elements[0];
// }

// console.log(firstElements([1, 2, 3]));
// console.log(firstElements(["a", "b", "c"]));
// console.log(firstElements([true, false]));
// generic을 활용하면 아래처럼 개선할 수 있다

function firstElements<T>(elements: T[]): T {
  return elements[0];
}

// 타입을 일일히 명시하지 않아도 공통적인 처리가 가능하다
console.log(firstElements([1, 2, 3]));
console.log(firstElements(["a", "b", "c"]));
console.log(firstElements([true, false]));

// 타입 별칭에도 사용 가능하다

type TCar<T> = {
  name: string;
  options: T;
};

// 사용할 때 타입을 정의해준다
const car1: TCar<string[]> = {
  name: "소나타",
  options: ["option1", "option2"],
};

// 서로 다른 타입도 공통적으로 치환해준다
const car2: TCar<string> = {
  name: "소나타",
  options: "option1",
};
```

### 타입 제약

```
// ex) 타입이 number인 length 속성이 있는 것들만 받겠습니다.
const getLength = <T extends { length: number }>(item: T): void =>
  console.log(item);
getLength([1, 2, 3]);
getLength(["hello!"]); // 정상 출력
// getLength(true); iterable한 데이터가 아니므로 오류를 반환한다
```
