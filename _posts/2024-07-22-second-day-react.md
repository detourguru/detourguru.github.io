---
layout: post
title: next.js 프로젝트캠프 7일차
subtitle: React 문법
cover-img: /assets/img/nextjs-bootcamp.png
thumbnail-img: /assets/img/nextjs-bootcamp.png
share-img: /assets/img/
tags: [react, Props, Components, Event]
author: Detourguru
---

# TIL

- `npm crate vite@latest`: react 프로젝트 생성 명령어
- `npm install`: package.json을 참조해 패키지를 install
- `package.json`: 프로젝트를 빌드하는데 필요한 패키지가 모두 들어있기 떄문에, 각별하게 주의해서 관리해야한다
- root component: main.tsx 에서 관리된다

# Font

- 폰트를 적용하는 세가지 방법:
  - `@import`를 통해 가져오기
  - `@font-face`를 통해 임의의 font-family를 등록 후 사용
  - 물리적 폰트 파일을 경로 내에 저장 후 상대경로로 지정하여 사용

# Component

- 컴포넌트 생성 기준: 작업이 반복되는 부분에 대해서 생성하면 된다

## 이벤트

- HTML과 동일하게 호출하면 되지만 호출명을 카멜케이스로 작성해야한다는 것이 차이점임 (ex: onClick, onKeyup)

```
const App = () => {
  let cnt = 0;
  const onClickHandler = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent> // 화살표 함수로 타입추론을 통해 작성할 수 있다
  ) => {
    cnt++;
    console.log(event); // 이벤트 객체 출력
    return alert(cnt + "회 눌렸습니다");
  };
  return (
    <>
      <h1>App Component</h1>
      <button onClick={onClickHandler}>클릭</button>
    </>
  );
};
export default App;
```

## props

- 컴포넌트에 원하는 데이터를 전달하는 방식
- 여러 곳에서 사용되거나, 전달할 속성 수가 너무 많을 때 별도의 type 및 interface 파일로 분리해 import 하여 사용한다
  - `index.d.ts`: 타입 정보만을 분리/정의 하는 파일 (definition)
- 배열, 객체 뿐만 아니라 함수를 넘길 수도 있다

```
export type TUserInfo = {
  uname: string;
  uage: number;
  ugender?: string;
  onFinishEat?: () => void; // 반환 값이 없는 일반적인 함수임
};
// 이때 글로벌한 함수 앞에는 관례적으로 on을 붙여준다
```

### children

- props으로 데이터를 받아올 때 import한 컴포넌트 태그 사이에 텍스트를 넣으면 props.children로 받아올 수 있다

```
// App.tsx
import RedColor from "./components/learn/children/RedColor";

const App = () => {
  return (
    <>
      <h1>App Component</h1>
      <RedColor>
        나는 <span style={{ textDecoration: "underline" }}>정말</span> 빨간색
      </RedColor>
    </>
  );
};
export default App;
```

```
// RedColor 컴포넌트
const RedColor = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div style={{ color: "red", fontSize: "50px", fontWeight: "bold" }}>
        {children}
      </div>
    </>
  );
};
export default RedColor;
```

# tailwind

- 1em === 4px
- ComponentPropsWithRef: 해당 타입을 사용 시 기존 html 요소의 속성과 동일한 이름으로 props를 받을 때 나머지 매개변수를 통해 모두 받아올 수 있다

```
type TInputProps = React.ComponentPropsWithRef<"input">;

const InputBox = ({ ...rest }: TInputProps) => {
  return (
    <>
      <input
        className="w-[240px] h-[44px] rounded-lg border border-[#4F4F4F] py-[13.5px] px-4 placeholder:text-[#ACACAC] outline-none text-black text-sm"
        {...rest}
      />
    </>
  );
};
export default InputBox;

```
