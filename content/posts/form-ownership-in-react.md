+++
date = '2026-07-12T21:48:45+09:00'
draft = true
title = '폼은 누가 가지고 있어야 할까?'
series = ['폼 설계 삽질기']
+++

RHF를 도입하면서 마주한 첫 번째 문제는 useForm() 호출 위치였다. 단순히 훅을 어디에 둘지의 문제가 아니라 폼 상태의 소유권을 어디에 둘 것인가의 문제였다.

## 페이지가 form을 가지고 있기?

가장 먼저 떠오른 방법은 각 편집 페이지가 자기 `useForm()`을 부르는 것이었다.

```tsx
function ItemFormPage() {
  const form = useForm();

  return (
    <FormProvider {...form}>
      <ItemForm />
    </FormProvider>
  );
}
```

그런데 이 에디터는 저장 버튼이 페이지에 있는 것이 아니라 header에 있었다. 페이지가 폼을 가지게 되면 헤더는 그 폼에 접근할 방법이 없다.

```text
Layout
 ├─ Header (저장 버튼이 여기에 있다)
 └─ Outlet
     └─ Page
         └─ useForm() // header는 접근 못함
```

### Props으로 전달하면 어떨까?

```tsx
<Layout form={form}>
  <Page form={form} /> // 이렇게 form을 전달하면 되지!
</Layout>
```

하지만 우리 서비스는 꽤 복잡한 구조의 데이터를 관리해야했기 때문에 이미 각 엔티티에 해당하는 편집 페이지가 여러개였다. 게다가 폼 상태를 필요로 하는 UI가 계속 늘어날 수밖에 없었다. 예를 들면 저장 버튼, validation 에러 표시, 이 외로도 수많은 ui 컴포넌트와 같은 UI들이 폼 상태에 접근해야했다. 이때 UI들은 또 자기만의 UI요소를 가질 수 있었고 그렇게되면 중간 UI 컴포넌트들이 필요도 없는 props을 받아서 하위에 내려줘야했다. 소위 말하는 Props drilling이 발생하기 쉬운 구조였다.

## Layout이 form을 가지게 만들기!

폼을 필요로 하는 컴포넌트들의 공통 부모는 Layout이었으니 form의 소유권도 Layout으로 올리는 것이 자연스러웠다.
그래서 `useForm()`을 페이지가 아니라 Layout 한 곳에서만 부르기로 했다. 대신 각 페이지는 자기 스키마와 기본값을 라우트의 `handle`에 실어서 선언만 하도록 바꿨다.

```tsx
// 각 페이지는 자기 폼 설정을 선언만 한다
{
  path: 'items/:id',
  element: <ItemFormPage />,
  handle: { formConfig: ItemFormPage.formConfig },
}
```

Layout은 `useMatches()`로 현재 라우트의 `formConfig`를 읽어서 폼을 만든다.

```tsx
const matches = useMatches();
const config = matches[matches.length - 1]?.handle?.formConfig;

const methods = useForm({
  resolver: config?.schema ? zodResolver(config.schema) : undefined,
  defaultValues: config?.defaultValues,
});

return (
  <FormProvider {...methods}>
    <Sidebar />
    <Outlet />
  </FormProvider>
);
```

이렇게 하니 두 가지가 한 번에 풀렸다. 헤더는 `useFormContext()` 한 줄로 `handleSubmit`에 접근할 수 있게 됐고, 새 엔티티 페이지를 추가할 때도 `useForm` 보일러플레이트를 반복할 필요 없이 스키마 선언만 하면 됐다.

### 전역 스토어를 쓰면 안되나?

사실 처음에는 Context와 Store의 차이가 애매하게 느껴졌다. 둘 다 여러 컴포넌트에서 값을 꺼내 쓸 수 있으니까.
최상위를 context로 감싸면 store가 왜 필요할까? 반대로 store를 쓰면 되는데 context를 왜 써야할까?

하지만 이번의 작업으로 확실하게 구분이 가능하게 되었다.

```
context -> 특정 컴포넌트 트리 안에서 동일한 값을 공유하기 좋음
store -> 트리와 관계 없이 상태에 전역적인 접근/변경이 필요할 때
```

이번 작업은 애플리케이션 전체가 공유해야 하는 상태가 아니라 하나의 화면 안에서 같은 form 인스턴스를 공유해야 했다.

그래서 Context가 더 적합했다. `const form = useForm()`. 이 객체 안에는 handleSubmit, reset, formState 등의 폼 관리 기능이 모두 들어있다. 중요한 것은 값을 공유하는 것이 아니라 하나의 form 인스턴스를 공유하는 것이다.

zustand와 같은 전역 스토어를 쓸 수도 있었겠지만, 그건 이 경우에는 상태 범위가 너무 넓어질 수 있었다. 폼은 이 화면 안에서만 의미가 있는 상태인데 도메인 어디서든 접근 가능해지면 스코프가 흐려진다. Context는 트리 범위 안에서만 접근 가능하다는 제약 덕분에 오히려 스코프도 명확해졌다.

## 해치웠나?

자! 이제 layout이 form을 가지니까 다 해결되었겠지? 라고 생각했다면... 오산이었다.

### 서버 데이터를 넣어주기

처음 Layout을 마운트하면 defaultValues가 form에 세팅된다. 그런데 defaultValues는 말 그대로 기본값이지, 서버에서 받아온 실제 데이터가 아니다. defaultValues는 useForm 생성 시점에만 적용되기 때문에, 이후 비동기로 응답이 도착해도 form에 자동으로 반영되지 않는다. 그래서 응답이 오면 직접 reset으로 값을 주입해줘야 했다.

```tsx
const { reset } = useFormContext();
const hasInitialized = useRef(false);

useEffect(() => {
  if (response && !hasInitialized.current) {
    // 한번만 reset하려고 lock 걸어줌
    reset(response.data);
    hasInitialized.current = true;
  }
}, [response]); // 서버 응답이 변경될 때마다 reset하면 사용자가 입력 중인 값도 덮어써질 수 있으니 딱 한번만
```

### 페이지 옮길 때마다 reset 해주기

이걸로 최초 진입 시 서버 데이터가 폼에 들어가는 문제는 풀렸다. 그런데 또 다른 문제가 남아 있었다. Layout Route 안에서 라우트가 변경돼도 Layout은 유지되고 Outlet 내부의 Page만 교체된다는 점이다.

즉 Layout이 만든 form 인스턴스도 그대로 유지되기 때문에, 다른 엔티티 편집 페이지로 넘어가도 이전 페이지에서 입력하던 값이 그대로 남아있었다. `hasInitialized`도 이미 true라서 새 서버 데이터로 reset되지도 않았다. 그래서 라우트가 바뀌는 시점(엔티티 id 변경)에 맞춰 form을 다시 초기화하도록 수정했다.

```ts
useEffect(() => {
  reset(defaultValues);
}, [id]); // 엔티티 id가 바뀔때마다 reset
```

## 배운점

단순히 저장 버튼 접근 문제를 푸는 거라 생각했지만 실제로는 폼 소유권을 다시 설계해야했던 큰 작업이었다. 버튼 하나 헤더로 빼려고 했을 뿐인데 라우트 구조, 스키마, Form 페이지 컴포넌트 전체를 건드리는 전환이 됐다.

같은 form 인스턴스를 참조해야 하는 컴포넌트가 많을수록 소유자를 위로 올리고 그렇지 않다면 가장 가까운 곳에서 생성하는 것이 자연스럽다는 것을 알게되었다.
