---
layout: post
title: next.js 프로젝트캠프 4일차
subtitle: JS (4) - 동기와 비동기
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [javaScript, async, awiat, promise, callback]
author: Detourguru
---

## TIL

#### 네이밍 규칙

- 카멜케이스 (testName): 관례적으로 이렇게 사용함
- 스네이크케이스 (test_name): 사용 권장하지 않음
- 파스칼케이스 (TestName): 생성자함수 또는 클래스 이름으로 사용

#### \_

- 반드시 받아야하는 매개변수지만, 받은 매개변수를 사용할 일이 없을 때 사용하지 않는 변수임을 의미하는 뜻

# Class

- 자바스크립트는 프로토타입 기반의 언어이고, 클래스는 원래 제공되지 않은 기능이었으나 ES6에서 추가되었다
  - 클래스가 제공되지 않았을때는 다른 객체의 생성자를 `Obj.call(this, var)`와 같이 호출하여 상속받았어야 했다
- 클래스로 인스턴스를 생성하면 프로토타입에 메서드를 별도로 추가해줄 필요가 없다.

```
// 클래스를 사용하지 않고 객체 생성
function Rectangle(color, width, height) {
  Shape.call(this, color); // shape 함수에서 color 불러옴
  this.width = width;
  this.height = height;
  this.getArea = function () {
    return this.width * this.height;
  };
}

const rectangle = new Rectangle("blue", 20, 20);
console.log(rectangle); // 여기에서 출력된 프로토타입에 getArea() 없음

// 클래스를 사용하고 객체 생성
class Rectangle extends Shape { // 명시적으로 상속받음
  constructor(color, width, height) {
    super(color); // 상속받은 상위 클래스의 color를 사용
    this.width = width;
    this.height = height;
  }
  getArea() {
    return this.width * this.height;
  }
}

const rectangle = new Rectangle("blue", 20, 20);
console.log(rectangle);
console.log(rectangle.getArea()); // 프로토타입에 getArea() 들어있음
```

## setter와 getter

- setter: speed 속성을 `설정할 때` 호출되는 메서드
- getter: speed 속성을 `가져올 때` 호출되는 메서드

```
class Car {
  constructor(name, speed) {
    this.#name = name;
    this.speed = speed;
  }
  #name; // private로 지정

  set speed(speed) {
    if (speed < 0) {
      // 예외처리
      throw new Error("속도는 음수가 될 수 없습니다");
    }
    // 속도가 0 이상인 경우, 내부적으로 _speed라는 변수에 저장
    // 여기서 speed를 그대로 사용하면 speed 속성을 설정하게 되어 재귀호출이 되어버리므로 다른 변수명을 사용한다
    this._speed = speed;
  }

  get speed() {
    return this._speed;
  }

  // get name() {
  //   return this.#name;
  // }
  getSpeed() {
    return `현재속도는 ${this.speed}입니다.`;
  }
  getCarName() {
    return `제 차 이름은 ${this.#name}입니다.`;
  }
}

const car = new Car("천송이", 11);
console.log(car.getCarName(), car.getSpeed());

// car.#name = "test"; private이라 변경할 수 없다는 에러 발생
// car.name = "test"; // private인 상태에서 name getter를 이용해 외부에서 변경해주려고 해도 내부적으로 속성이 등록되어 에러는 나지 않으나 변경도 되지 않음

```

## private, static

- private: constructor 아래에서 속성명 앞에 `#`을 붙여 지정해줄 수 있다. 외부에서 접근 및 변경이 되지 않는다.
- static: 식별자 앞에 `static` 키워드를 사용하면 정적 속성으로 만들어준다. **인스턴스로 접근할 수 없고, 클래스를 직접 불러와야 접근할 수 있다**.

# 내장 객체

> 참고: https://developer.mozilla.org/

- reduce: 배열의 모든 요소를 순회하며 어떤 값을 누산하고 싶을 때 활용할 수 있음

```
const sumWithInitial = array1.reduce(
    // 매개변수: 누계값(이전값), 현재값
  (accumulator, currentValue) => accumulator + currentValue,
  initialValue, // 초기값 (accmulator의 값 지정)
);

// 예제
const getTotalAge = (prev, cur) => prev + cur.age;
// 19.9
console.log(
    "학생들의 평균 연령 구하기: ",
    students.reduce(getTotalAge, 0) / students.length
);
```

### 파괴적 메소드와 비파괴적 메소드

- 원본 데이터에 영향을 주는 메소드를 파괴적 메소드라고 한다

# 동기와 비동기

- js는 싱글스레드 기반언어로 **기본적으로 동기 방식**으로 작동하며, 한번에 하나의 작업만을 처리할 수 있다.
- 때문에 별도의 비동기 방식을 지원한다. 그 방법으로는 콜백, promise, async가 있다.

## Callback

- 다른 함수의 매개변수로 전달되어 그 함수가 실행되는 동안 특정 시점에 호출되는 함수를 말한다.
- 동기 콜백함수와 비동기 콜백함수가 있다.

### 동기적 콜백함수

- 하나의 작업이 완료된 후에 다음 작업이 실행되므로 순서가 보장된다
- 반드시 이전 작업의 결과를 반환받아서 실행해야하는 등 실행 순서가 중요한 작업에서 사용된다

### 비동기적 콜백함수

- 이전 작업이 완료되기 전에 비동기적으로 다음 작업을 호출한다.
- 실행 순서 자체는 순차적이나 결과 출력이 비동기적으로 이루어진다.

```
function task1(callback) {
  setTimeout(() => {
    console.log("task1 start");
    callback(); // 이 시점에서 task2를 실행
  }, 1000);
}

function task2() {
  console.log("task2 start");
}

task1(task2); // 이때 task2를 task2()와 같이 함수 형태로 넘기게되면 callback 함수를 넘기는 것이 아니라 호출하게 되기 때문에 의도하지 않은 경우가 생길 수 있다.

```

## Promise

- 비동기작업을 처리할 수 있도록 도와주는 객체

```
const promise = new Promise((resolve, reject) => {
  // pending: 비동기 처리가 아직 수행되지 않은 상태
  // fulfilled: 비동기 처리가 수행된 상태
  // rejected: 비동기 처리가 실패한 상태

  // 이 함수를 실행할 때 pending > fulfilled로 상태가 넘어간다
  // promise의 result는 resolve 함수의 매개변수로 넘겨주는 값이 있을때 응답 결과로 들어간다
  resolve("success");

  // 예외처리를 위해 호출하는 함수
  // 매개변수 내에 exception을 전달할 수도 있다
  reject(new Error("fail!"));
});

promise
  .then((value) => console.log(value)) // fulfilled 상태에 실행되는 함수.  resolve에서 넘겨준 result 값이 넘어옴. 여기선 "success"가 넘어온다
  .catch((error) => console.error(error)) // rejected 상태에서 실행되는 함수.
  .finally(() => console.log("작업 완료")); // 어떤 상태에서든 마지막으로 실행되는 함수
```

```
const fetchNumber = () =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(1); // 1을 넘겼다
    }, 1000);
  });

// then()은 연속처리가 가능하지만 then()에서 에러가 나면 이후의 then()은 실행되지 않는다
fetchNumber()
  .then((num) => num * 2)
  .then((num) => num * 3) // resolveLike를 통해 연속해서 처리가 가능하다
  .catch((num) => num) // catch로 예외처리 후 resolve()를 반환하는 것과 같기 때문에 다음 then으로 연속 처리가 가능
  .then((num) => console.log(num)); // fetchNumber 함수의 resolve에서는 1을 넘겼으나 위의 연속된 처리로 인해 6을 반환함

```

## async & await

- async: promise 문법을 대신해 보다 간결한 문법의 async를 사용할 수 있게 되었음
- await: async 문법 내에서 비동기 실행이 끝날 때까지 대기해준다.

```
const delay = (ms) => {
  return new Promise((resolve) => {
    console.log("delayed");
    setTimeout(resolve, ms);
  });
};

// 비동기 함수 안에 await로 delay 결과를 반환받을 때까지 대기
async function task1() {
  await delay(1000);
  return "task1 started";
}

task1().then((msg) => console.log(msg));


// 비동기처리를 병렬로 실행 후 await 하도록 하는법
const startTasks = async () => {
  console.time();

  const task1Promise = task1(); // 여기서 비동기 호출의 결과를 변수에 저장한다
  const task2Promise = task2();
  const task3Promise = task3();

  // allSettled를 사용해도 모든 작업을 병렬적으로 처리하고 대기하는 동일한 결과를 얻을 수 있다
  // const results = await Promise.allSettled([task1Promise, task2Promise, task3Promise]);

  const result1 = await task1Promise; // 여기서 모두 결과를 대기한다
  const result2 = await task2Promise;
  const result3 = await task3Promise;

  console.log(result1, result2, result3); // await 키워드가 없다면 결과를 대기하지 않아서 여기서 출력 시 undefined가 반환될 가능성이 있다.

  console.timeEnd();
};
```
