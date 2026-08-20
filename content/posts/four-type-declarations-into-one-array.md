+++
date = '2026-08-20T18:11:03+09:00'
draft = false
title = '타입 선언 4개를 배열 하나로 합치기'
+++

외부 API를 쓰다보면 같은 데이터인데도 요청과 응답의 키 값이 다르게 생긴 형태의 데이터를 만날 때가 종종 있다.

```
// 예시: KOPIS Open API
요청: shcate=GGGA
응답: <genrenm>뮤지컬</genrenm>
```

그런데 이걸 타입스크립트로 옮겨 놓으면 타입 선언만 이만큼 나온다.

```ts
export type GenreCode = "AAAA" | "GGGA";
export type GenreName = "연극" | "뮤지컬";

export const GENRE_OPTIONS: { value: GenreCode; label: GenreName }[] = [
  { value: "AAAA", label: "연극" },
  { value: "GGGA", label: "뮤지컬" },
];

export const GENRE_NAME_MAP = { AAAA: "연극", GGGA: "뮤지컬" } as const;
```

게다가 더 별로인 점은 전부 같은 정보인데 타입으로 정리하기위해 다른 모양으로 적어둔 것 뿐이라 항목을 하나 추가하려면 4곳을 수정해야한다.
배열 하나로 관리할 수 있는 방법이 없을까 고민해보았고 실제로 타입스크립트가 그걸 지원한다는 사실을 알게되었다.

## 왜 굳이 리터럴로 적어두는가

줄이는 방법을 찾기 전에 애초에 왜 `string`으로 두지 않고 `"AAAA" | "GGGA"`처럼 적어두는지부터 짚고 넘어가보자면,

타입은 값들의 집합이다. 어떤 변수의 타입이 곧 그 변수가 가질 수 있는 값의 목록인 셈이다.
데이터 타입 `string`은 모든 문자열의 집합이므로 타입이 `string`인 변수에는 어떤 문자열이든 넣을 수 있다.
리터럴 타입은 이 집합의 원소를 값 하나로 고정한 타입이다.

```ts
let a: string = '안녕';     // a의 집합 = 모든 문자열
let b: 'DETAIL' = 'DETAIL'; // b의 집합 = {'DETAIL'} 하나뿐

a = '잘가';      // OK: '잘가'는 모든 문자열의 집합에 속한다
b = 'COMPLETED'; // Error: 'COMPLETED'는 {'DETAIL'}에 속하지 않는다
```

유니온은 여러 타입을 묶어서 이 타입의 집합 요소 중 하나임을 표시한다.

```ts
type Id = string | number; // 문자열이거나 숫자
```

만약 해당 타입 내에 리터럴 타입이 있다면 이 타입은 리터럴 유니온 타입으로 불린다.
`'black'`과 `'blue'`가 각각 리터럴 타입이고, `FavoriteColor`는 그 둘의 합집합이다.

```ts
type FavoriteColor = 'black' | 'blue';
```

리터럴 유니온을 사용할때의 장점은 하드코딩 된 값을 달고다닐 필요가 없기도 하고 무엇보다 타입을 좁힐 수 있기 때문이다.

```ts
function paint(color: FavoriteColor) {
  if (color === 'black') {
    // 여기서 color의 타입은 'black'으로 확정된다
  }
  // 여기서는 남은 'blue'로 확정된다
}
```

이 덕분에 나중에 다른 리터럴인 `'red'`를 추가하더라도 처리하지 않은 자리를 컴파일러가 전부 찾아준다는 장점도 있다.
결국 앞의 4중 선언은 이 리터럴 유니온을 손으로 유지하려다 생긴 비용이었다.

## 배열 하나에서 타입을 꺼낼 수 있다

타입도 배열처럼 대괄호 접근을 할 수 있다. `[number]`는 인덱스가 number인 케이스 전부를 가져오기 때문에 해당 자리의 유니온 타입이 된다.
그리고 키 값으로 접근하면 해당 키의 타입을 다 가져온다. 예를 들어 `["value"]`로 접근하면 해당 타입의 value 타입을 다 가져오는 것이다.

단 배열로 접근할 타입이 as const로 정의되어야한다. 그러지 않으면 원시 타입으로 타입을 넓혀버리므로 값을 가져와도 원시 타입이 반환될 뿐 큰 의미가 없기 때문이다.

```ts
const A = [{ value: "AAAA" }];             // { value: string }[]
const B = [{ value: "AAAA" }] as const;    // readonly [{ readonly value: "AAAA" }]
```

여기까지만 해도 아까의 4번 선언된 코드를 대폭 줄일 수 있다. 이정도로만 해도 아주 큰 개선 같다.

```ts
const OPTIONS = [
  { value: "AAAA", label: "연극" },
  { value: "GGGA", label: "뮤지컬" },
] as const;

// 필요한 형식대로 꺼내서 쓴다
type GenreCode = (typeof OPTIONS)[number]["value"];
```

하지만 여전히 거의 동일해보이는 값을 가지고 이렇게 따로 관리해줘야하는게 불편하기도했고, 이런 타입이 장르 뿐만 아니라 14개의 값을 가지는 지역구분도 있고 공연상태도 있고... 아무래도 코드가 반복되는 것 같아서 이걸 줄여보기로 결심했다.

## 헬퍼로 빼려니 리터럴이 사라졌다

보통 반복되는 코드는 헬퍼 함수로 빼기때문에 헬퍼 함수를 만들려고 보니 인자로 넘기는 순간 리터럴이 사라져서 string 타입을 반환해주었다.

호출부에서 매번 `as const`를 붙이게 하면 되겠지만 까먹는 즉시 리터럴 없는 타입을 반환해줄 것이기 때문에 좋은 패턴같지 않았다.

그래서 TypeScript 5.0에 추가된 [const 타입 파라미터](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#const-type-parameters)를 통해 이 현상을 해결할 수 있었다.

```ts
// const 파라미터 없이
function createTableNoConst<
  T extends readonly { value: string; label: string }[],
>(options: T): T {
  return options;
}

// const 파라미터를 추가
function createTableConst<
  const T extends readonly { value: string; label: string }[],
>(options: T): T {
  return options;
}

const rA = createTableNoConst([{ value: "AAAA", label: "연극" }]);
// T = { value: string; label: string }[]

const rB = createTableConst([{ value: "AAAA", label: "연극" }]);
// T = readonly [{ readonly value: "AAAA"; readonly label: "연극" }]
```

`const`를 붙이면 인자로 넘어온 배열 리터럴을 호출부에서 `as const`를 붙인 것처럼 추론한다. 그래서 as const 없이 전달받은 인자를 헬퍼 안에서 `T[number]["value"]`로 접근해도 `"AAAA" | "GGGA"`를 받아올 수 있다.

## 그래서 만든 createCodeTable

그래서 내가 작성한 헬퍼함수는 아래와 같다.

```ts
// CodeOption: string으로 들어오는 {value, label} 타입
export type CodeOption<TCode extends string, TName extends string> = {
  value: TCode;
  label: TName;
};

export type CodeTable<TCode extends string, TName extends string> = {
  options: readonly CodeOption<TCode, TName>[]; // {value, label}[]
  codes: readonly TCode[]; // value[]
  nameByCode: Record<TCode, TName>; // {value : label}
};

// 여기가 포인트! {value, label}[]를 받아 CodeTable을 반환한다
export function createCodeTable<
  const TOptions extends readonly CodeOption<string, string>[], // const 파라미터를 넘김
>(
  options: TOptions,
): CodeTable<TOptions[number]["value"], TOptions[number]["label"]> {
  type TCode = TOptions[number]["value"];
  type TName = TOptions[number]["label"];

  const codes = options.map(({ value }) => value) as TCode[];

  return {
    options,
    codes,
    nameByCode: Object.fromEntries(
      options.map(({ value, label }) => [value, label]),
    ) as Record<TCode, TName>,
  };
}
```

이 헬퍼 함수를 통해 쓰는 쪽은 이렇게 중복을 줄일 수 있었다.

```ts
export const GENRE = createCodeTable([
  { value: "AAAA", label: "연극" },
  { value: "GGGA", label: "뮤지컬" },
]);

export type GenreCode = CodeOf<typeof GENRE>; // "AAAA" | "GGGA"
export type GenreName = NameOf<typeof GENRE>; // "연극" | "뮤지컬"
```

### 읽기만 할 값은 readonly로 받자

> `const` 타입 파라미터는 `as const`처럼 동작해서 결과 타입도 자동으로 `readonly`가 된다.

createCodeTable로 반환받은 options의 원본 배열을 건드리는 push()나 sort()와 같은 내장 함수를 사용하려 하면 다른 화면까지 영향을 받을 수밖에 없는데, `readonly T[]`는 애초에 그런 메서드가 없어서 이 경로를 타입 단계에서 막아줄 수 있다. 그래서 이 값을 받는 컴포넌트 쪽 파라미터도 `T[]`가 아니라 `readonly T[]`로 받게 고쳤다. 읽기만 할 파라미터는 웬만하면 `readonly`로 받는 게 손해 볼 일 없는 습관인 것 같다.

## CodeOf와 NameOf는 infer로 만들었다

위의 `CodeOf`와 `NameOf`는 조건부 타입과 `infer`를 가지고 만들어 주었다.
`infer`는 모르는 타입이 들어올건데 일단 `infer TypeName`과 같이 가칭을 붙여뒀다가 그 자리에 무슨 타입이 들어오든 TypeName이라는 가칭으로 그 타입에 접근할 수 있도록 사용할 수 있다.

```ts
export type CodeOf<T> = T extends CodeTable<infer TCode, string> ? TCode : never;
export type NameOf<T> = T extends CodeTable<string, infer TName> ? TName : never;
```

그러니까 CodeOf를 예를 들어 설명해보면 `T`가 `CodeTable<TCode, string>` 모양으로 들어올 때 TCode를 돌려주고, 이 모양이 아니라면 never 를 반환해준다.

```ts
export const GENRE = createCodeTable([
  { value: "AAAA", label: "연극" },
  { value: "GGGA", label: "뮤지컬" },
]);

export type ReturnCode = CodeOf<typeof GENRE>; // "AAAA" | "GGGA"
export type ReturnNever = CodeOf<string>; // never
```

이때 주의할점은 `never` 타입 필드에는 어떤 값도 들어갈 수 없기 때문에 아래와 같이 사용할 경우 AgeRateName가 의도된 타입이 아닌 never를 반환하기 때문에 에러가 나지 않고 그냥 never로 타입이 정해져버린다. 그렇게되면 해당 필드는 타입이 있는데도 타입을 전혀 보호받지 못하게 된다.

```ts
const AGE_RATE = null;
export type AgeRateName = NameOf<typeof AGE_RATE>; // never
```

때문에 `T extends CodeTable<string, string>`와 같이 제약을 추가해주는 것이 좋다.

```ts
export type NameOf<T extends CodeTable<string, string>> = T extends CodeTable<string, infer TName> ? TName : never;
```

## 가독성 vs 코드 중복 제거

단점이라면 한눈에 코드가 들어오지 않고 이게 그래서 정확히 어떤 코드인지 파악하는데 난이도가 좀 있는 것 같다. 그래서 팀원들이 있었더라면 헬퍼를 사용하지 않았을 수도 있을 것 같다. 귀찮더라도 아래처럼 작성했을 것이다.

```ts
export const GENRE_OPTIONS = [
  { value: "AAAA", label: "연극" },
  { value: "GGGA", label: "뮤지컬" },
] as const;

export type GenreCode = (typeof GENRE_OPTIONS)[number]["value"];
export type GenreName = (typeof GENRE_OPTIONS)[number]["label"];
```

하지만 1인 프로젝트에 학습 목적도 있었고, 게다가 거의 모든 응답이 요청과 응답의 키값이 달랐기 때문에 이 프로젝트에는 적절한 도입이었던 것 같다.

## 배운점

코드의 양도 양이지만 일단 선언 여러개를 하나로 합쳤다보니 타입이 어긋날일이 드라마틱하게 줄었다는 것이 좋았다. 지역 목록에 항목을 추가하면 타입, 옵션, 검증도 알아서 따라오고 다른 소비처에선 컴파일 에러가 나서 빠트린 쪽을 바로바로 알 수 있었다.

그리고 이번 기회로 저 헬퍼를 작성하며 모호하게 이해하고있던 리터럴, 유니온 타입, infer, readonly 개념 등을 다시 한번 잡을 수 있어서 좋은 기회였다고 생각한다.
