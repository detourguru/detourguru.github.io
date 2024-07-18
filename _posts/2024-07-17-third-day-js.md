---
layout: post
title: next.js 프로젝트캠프 3일차
subtitle: JS (3) - 함수와 객체, 호이스팅
cover-img: /assets/img/nextjs.png
thumbnail-img: /assets/img/nextjs.png
share-img: /assets/img/
tags: [javaScript, function, object, hoisting]
author: Detourguru
---

## TIL

- iterable 길이: `${var}.length`로 확인 가능함

```
const numArr = [0, 1, 2];
console.log(numArr.length);
```

- 거듭제곱 연산자: `**`

```
2 ** 3 = 8 // 2의 3제곱
3 ** 2 = 9 // 3의 2제곱
```

- 다중 반복문: 반복문 안에 반복문을 사용하는 형태
- console.dir(obj): 객체의 프로퍼티를 자세하게 확인하기 위한 함수

# 함수

### 함수 선언식

- 함수 선언식으로 선언된 함수는 호출 위치에 상관없이 함수가 정상적으로 호출된다.

  ```
  gugudan3(); // 둘 다 정상 호출
  function gugudan3() {
    for (let i = 1; i < 10; i++) {
      console.log(`3*${i}=${i * 3}`);
    }
  }
  gugudan3(); // 둘 다 정상 호출
  ```

### 함수 표현식

> 함수를 변수에 담아 표현할 수 있다. 함수 선언식을 실행할때는 실제 js엔진에서 이런 방식으로 실행된다

- 기명함수: 공식적으로 권장되는 함수 사용 방식으로 함수 자체에 이름이 있기 때문에 에러발생 시 해당 함수명이 노출되어 디버깅이 비교적 용이함 (익명함수 에러 발생 시 [Function (anonymous)] 와 같이만 표시됨)

  ```
  const gugudan = function gugudan4() {
  	for (let i = 1; i < 10; i++) {
  		console.log(`4*${i}=${i * 4}`);
  	}
  }
  gugudan(); // 이렇게 호출해야함
  gugudan4(); // 이렇게 호출해도 아무것도 불러오지 않음
  ```

- 익명함수
  ```
  const gugudan = function () {
  	for (let i = 1; i < 10; i++) {
  		console.log(`5*${i}=${i * 5}`);
  	}
  }
  ```

### 화살표 함수

- 변수에 담아서 호출하지 않으면 실제로 호출할 수 있는 방법이 없음
- 콜백 함수와 같이 간단한 로직을 1회성으로 사용할때 활용도가 높음
- 가독성이 좋은 함수 사용법
- 함수 선언식으로 선언된 함수와 달리 먼저 선언된 후에야 함수가 정상적으로 호출된다.

```
// () => {} 의 문법으로 작성 가능

// 콜백함수 예시
const squared = numbers.map((x) => x * x);

// 선언식 함수와 화살표 함수
function declareFunc(a, b) {
  return console.log(`declare function: ${a + b}`);
}

const arrowFunc = (a, b) => {
  return console.log(`arrow function: ${a + b}`);
};

// 함수 내 별다른 로직 없이 값이 반환되어도 되는 경우 중괄호 및 return 키워드를 지우고 아래와 같이 작성이 가능하다
const arrowFunc2 = (a, b) => console.log(`arrow function2: ${a + b}`);

// 객체(object) 반환시에는 소괄호로 묶어주어야한다
const arrowFunc3 = (a, b) => ({
  param1: a,
  param2: b,
});


// 모두 3을 반환
declareFunc(1, 2);
arrowFunc(1, 2);
arrowFunc2(1, 2);
```

### 매개변수 / 파라미터

    ```
    function gugudan(dan) {
      for (let i = 1; i < 10; i++) {
        console.log(`${dan}*${i}=${i * dan}`);
      }
    }
    gugudan(3); // 3단이 출력된다

    gugudan(); // undefined * 1 = undefined와 같이 출력됨

    // 매개변수가 넘어오지 않을 때를 대비해 아래와 같이 기본값을 지정할 수 있다
    function gugudan(dan = 3) {
      // 코드의 내용
    }
    ```

- 파라미터를 가변적으로 받는 방법: 나머지 매개변수 `...args`

```
function add(...a) {
  // 파라미터는 이렇게 출력도 되지만
  console.log(a)

  // 아래와 같이 출력해보면 유사 배열객체 arguments를 확인할 수 있다
  console.log(arguments);
}

add(10, 20); // 2개를 받을 수도 있고
add(10, 41, 23); // 3개를 받을 수도 있다 ([10, 20], [10, 41, 23]과 같이 배열의 형태로 받음)

function add(a, ...args) {
  // 명시적으로 파라미터를 받을 때와 혼용해서 사용이 가능하다
}
```

### return

- **함수 내에서** 값을 반환하기 위해 사용하는 키워드
- return을 만나면 코드가 종료되므로 뒤에 작성된 코드는 실행되지 않음
  - 이때 return을 통해 반환되는 값이 없더라도 실질적으로는 undefined가 반환되므로 코드 종료를 목적으로 사용한다고 보기에는 무리가 있다

```
function add(a, b) {
    return a + b;
}

const sum = add(1, 2);
// sum = 3;

function membership(isLoggined) {
    if (!isLoggined) {
        return "로그인이 필요합니다";
    }
    return {
        name: "디투",
        grade: "vip",
    }
}
```

- 함수 내에서 함수를 반환할 수도 있다

```
// 외부함수
function depth0() {
    // 내부함수
  return function () {
    return function () {
      return {
        name: "디투",
        grade: "vip",
      };
    };
  };
}

const depth1 = depth0(); // 내부 함수를 출력시에는 변수에 담았을 지라도 함수와 같은 형태로 호출해야함
const depth2 = depth1();

// 내부함수들의 return 결과를 출력하는 두가지 방법
console.log(depth2());
console.log(depth0()()());
```

### 재귀함수

- 자기자신을 다시 호출하는 함수

```
// 팩토리얼을 구하는 함수1
const factorial2 = (int) => {
  let sum = 1;
  for (let i = int; i > 0; i--) {
    sum *= i;
  }
  return sum;
};
console.log(factorial2(5)); // 120

// 팩토리얼을 구하는 함수2: 재귀함수를 사용한 함수
const factorial3 = (int) => {
  if (int === 0 || int === 1) return 1;
  else return int * factorial3(int - 1);
};
console.log(factorial3(5)); // 120
```

### Closure

- 함수가 선언될 당시의 외부 변수에 대한 접근 권한을 유지하며, 이러한 변수에 접근할 수 있는 함수를 **클로저 함수**라고 부른다.

```
function outer() {
  let cnt = 0;
  return function inner() { // 클로저 함수
    cnt++;
    console.log(cnt);
  };
}

const counter = outer();
counter(); // 1
counter(); // 2
counter(); // 3: 외부 변수에 대한 접근 권한을 유지하고 있어 함수가 호출 될 때마다 계속 값이 초기화되는 것이 아니라 누적된다.
```

### 생성자 함수

- 여러 객체의 속성이 같고, 값이 다른 경우의 객체를 반복적으로 생성할 수 있는 함수
- this 키워드를 사용해 각 속성을 생성한다
- new 키워드로 객체를 생성한다는 것은 아래와 비슷한 동작을 한다

```
function obj(name, age, gender) {
    this = {}; // 임의의 빈 객체를 만들고

    // 속성을 추가한다
    this.name = name;
    this.age = age;
    this.gender = gender;

    return this; // 반환
}
```

```
function User(name, age, gender) {
  this.name = name;
  this.age = age;
  this.gender = gender;
  this.introduce = () => {
    console.log(
      `안녕하세요~ 제 이름은 ${this.name}이고, 나이는 ${this.age}예요. 그리고 ${this.gender}입니다!`
    );
  };
}

const user1 = new User("Lucia", 29, "Female"); // 객체 호출
user1.introduce(); // 안녕하세요~ 제 이름은 Lucia이고, 나이는 29예요. 그리고 Female입니다!
```

### Prototype

- 모든 객체들은 항상 프로토타입 속성을 가진다.
- 함수로 생성된 객체들은 prototype에 들어있는 값들을 참조할 수 있다. 그 객체는 해당 함수의 프로토타입 객체를 자신의 프로토타입으로 설정한다.
- 프로토타입체인: 인스턴스 내부의 `__proto__` 속성으로 자신을 생성한 생성자 함수의 프로토타입 객체를 참조하는 현상
- 내 함수 내에서 정의하지 않은 메서드라고 해도 인스턴스 메서드라면 프로토타입 체이닝을 통해 상위 객체의 메서드를 상속받아 사용할 수 있다.

```
function User(name, age, gender) {
  this.name = name;
  this.age = age;
  this.gender = gender;
}

User.prototype.introduce = function () {
  console.log(
    `안녕하세요~ 제 이름은 ${this.name}이고, 나이는 ${this.age}예요. 그리고 ${this.gender}입니다!`
  );
};

const user1 = new User("Lucia", 29, "Female");
user1.introduce(); // 실제 생성자 함수에 선언하지 않아도 프로퍼티에 들어있음
console.dir(user1.__proto__); // prototype 객체를 가르킨다

console.log(user1.__proto__ === User.prototype); // true
```

# This

- **자신을 호출한 객체**를 가리키는 특수한 키워드

```
// this를 호출한 최상위 객체인 윈도우 객체가 출력됨
console.dir(this);

// 전역함수이므로 최상위 객체인 윈도우 객체가 출력됨
const member = () => {
    console.log(this);
}

// 메서드에서 출력하고 있으므로 자신을 호출한 객체인 membership 객체가 출력됨
const membership = {
  name: "디투",
  // 객체 내의 함수는 메소드라고 부름
  joined: function () {
    console.log(this);
  }.bind({ test: "메롱" }) // bind를 사용해 내가 원하는 객체로 this를 지정할 수 있다,
  // 화살표함수 안의 this는 밖에서 상속받은 것이므로 this를 호출하면 최상위객체인 window가 출력됨
  <!-- age: () => {
    console.log(this)
  } -->
}

// 전역변수에 담고 호출했으므로 최상위 객체인 window가 출력됨
// bind를 사용했다면 bind로 지정한 객체를 출력하게 된다
const joined = membership.joined;
joined();
```

# 호이스팅

- 코드의 실행 순서와는 상관없이 온전한 선언 부분이 최상단으로 js엔진에 의해 끌어올려지는 현상이다(전체 선언이나 값 초기화). 아래 설명되는 call stack 구조에 의해 해당 현상이 발생한다.
- let, const 키워드도 호이스팅이 발생하나, 선언부만이 호이스팅 되는 것이고 참조는 업데이트 이후 시점에서나 가능하므로 var나 함수선언문으로 선언된 함수와는 동작원리가 상이하다.

### call stack

- js의 스택 자료구조는 선입선출이 기본이다.
- js 코드는 반드시 하나의 **전역 실행 컨텍스트** 안에서 실행되며, 이는 디폴트로 생성되는 실행 컨텍스트이다. **이후 실행 컨텍스트들은 함수가 호출될 때 생성**된다.
- 실행 컨텍스트의 실행이 끝나고나면 해당 실행 컨텍스트는 메모리에서 제거(종료) 된다.
- 실행 컨텍스트란 js코드가 실행될 때 필요한 환경을 제공해주는 객체이다.
- 실행 컨텍스트 안에는 크게 두가지 객체가 있다: record, outer.

  - record: 생성 (변수, 함수 선언 등을 기록), 실행(기록된 값을 참조하거나 코드의 선언된 부분 중 미완성된 값을 업데이트 및 실행) 단계가 있다.
    - 이때 함수선언문으로 선언된 함수와 var 키워드로 선언된 변수는 생성 단계에서 함수 내용 및 값을 저장해두기 때문에 정의 전에 호출되어도 에러가 발생하지 않고 실행이 된다.
  - outer: 선순위 실행 컨텍스트와 연결하는 통로의 역할이 된다

```
console.log(test);
var test = "test"; // var 키워드로 선언 시에는 생성 단계에서 호이스팅되어 undefined 초기화 값이 지정됨. 따라서 실행 시 undefined가 출력된다.
// let test = "test2"; // let, const 등의 키워드로 선언시에는 초기화 값이 지정되지 않음. 따라서 실행시 에러가 발생한다.

test(); // 함수선언문으로 선언된 함수이므로 호이스팅 되어 에러 발생 없이 실행됨
function test() {
    return true;
}

test2(); // const 키워드는 호이스팅 되었으나 TDZ(temporal dead zone)에 의해 아직 값에 접근할 수 없어 에러가 발생함
const test2() => true;

// 아래와 같은 코드가 있다고 할 때
testFunc();
var testFunc = () => {}; // var 키워드는 호이스팅에 의해 undefined으로 먼저 초기화되므로 testFunc() 실행 시 해당 함수를 찾을 수 없다는 에러가 나옴
let testFunc = () => {}; // TDZ로 testFunc() 실행 시 reference 에러가 발생함


// 전역실행 컨텍스트 실행 > const num, prinNum()을 저장
// printNum() 실행 시 실행 컨텍스트 생성
// 해당 실행 컨텍스트에서 num을 참조할 때 선언된 값이 없으므로 outer를 통해 선생성된 컨텍스트에서 num이 선언된 값을 찾는다
// 전역실행 컨텍스트에서 선언된 const num을 가져온다 (10)
// 10이 출력됨
const num = 10;
function printNum() {
    console.log(num);
}
printNum(); // 10이 출력된다

// 전역실행 컨텍스트 실행
// const num, prinNum()을 저장
// printNum() 실행 시 실행 컨텍스트 생성
// 해당 실행 컨텍스트에서 num을 참조할 때 선언된 값을 참조한다 (20)
// 20이 출력됨
// 이 경우 서로 다른 실행 컨텍스트 내에서 생성 & 실행되기 때문에 const 키워드로도 중복된 변수 사용이 가능

const num = 10;
function printNum() {
    const num = 20;
    console.log(num);
}
printNum(); // 20이 출력된다
```

# 객체

- 다양한 자료형의 데이터를 속성으로 가질 수 있다
- 동적으로 속성을 추가 및 제거할 수 있다.
- 객체의 속성을 순회할 수 있다

```
const obj = {};
obj.color = "yellow"; // 동적으로 프로퍼티 생성
delete obj.color; // 삭제

console.log(obj.color); // 존재하지 않는 프로퍼티 조회시 undefined 반환

```

### 메소드 (method)

- 객체 내의 함수를 뜻함

```
const membership = {
  // 객체 내의 함수는 메소드라고 부름
  joined: () => {
    console.log(this);
  },
  getAge() { // 메소드는 이렇게 작성할 수도 있다
    return 20;
  },
};

```
