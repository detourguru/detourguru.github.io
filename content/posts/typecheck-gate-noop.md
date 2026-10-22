+++
date = '2026-10-22T00:00:00+09:00'
draft = true
title = '타입 검사 명령이 있는데 왜 타입 에러가 머지됐을까?'
description = 'Vite 빌드는 타입을 보지 않고, 루트 tsconfig가 references만 가진 구조에서는 tsc --noEmit도 아무 파일을 검사하지 않은 채 성공한다. 몽글 프론트에서는 이 두 가지가 겹쳐서 저장소의 어떤 명령도 타입을 검사하지 않는 상태가 됐다. typecheck를 tsc -b로 고친 뒤에도 이 명령을 아무도 돌리지 않아서 미리보기에 이벤트 대사가 안 나오는 버그가 머지됐다. CI를 붙인 뒤에는 검사를 단계별로 나눠서 실패 하나가 다른 실패를 가리지 않게 했다.'
tags = ["TypeScript", "디버깅", "테스트"]
+++

<!-- 저자 확인 필요:
- build에서 tsc -b를 뺀 건 내 커밋(Sentry 컨텍스트 작업 커밋에 섞여 들어감)이다. 본문에는 누가 뺐는지 쓰지 않았다. 밝힐지 직접 정하기. 뺀 이유는 커밋에 기록이 없어서 쓰지 않았다
- 미리보기 대사 버그는 다른 개발자의 커밋에서 생겼다. 본문에는 누구 커밋인지 쓰지 않았다
- tsc --noEmit 실험은 AI가 재현용으로 만든 최소 예제다(TypeScript 5.7.3, 저장소와 같은 버전). 직접 한 번 돌려 보고 출력이 같은지 확인하기
- typecheck가 아무것도 검사하지 않는다는 걸 처음 어떻게 알게 됐는지는 기록이 없어서 쓰지 않았다. 계기가 기억나면 두 번째 섹션 앞에 넣기
- qa push에서는 lint, tsc, vitest가 실패해도 배포를 막지 않는다(빌드 실패만 막는다). 넣을지와 그렇게 정한 이유는 직접 쓰기
- 그림: 미리보기에서 대사가 비어 있는 화면 캡처가 있으면 도입에
- 배운점 문장
- 모바일 에디터와 이벤트 대사가 무엇인지 한 문장씩 넣을지 직접 정하기
-->

QA용 e2e 스펙을 새로 넣고 `tsc -b`를 돌렸더니, 이번 작업에서 건드리지도 않은 모바일 에디터 미리보기 파일에서 타입 에러 4건이 나왔다.

이벤트 대사 필드가 `script` 문자열 하나에서 `scripts` 배열로 바뀌었는데, 미리보기는 아직 `script`를 읽고 있었다. 그러니 `script` 값은 항상 `undefined`였고, 모바일 에디터 미리보기에는 이벤트 대사가 한 줄도 나오지 않는 상태였다. 그런데도 이 코드는 빌드를 통과해서 qa 브랜치에 그대로 머지돼 있었다.

<!-- 그림: 미리보기에서 이벤트 대사가 비어 있는 화면 -->

## 빌드는 타입을 보지 않는다

회사에서 개발 중인 서비스인 몽글은 프론트를 Vite로 빌드하는데, Vite는 `.ts` 파일을 변환만 하고 타입 검사는 하지 않는다. [Vite 문서](https://vite.dev/guide/features.html#transpile-only)에도 타입 검사는 IDE와 빌드 과정에서 따로 해야 한다고 적혀 있다. 그래서 Vite의 React TypeScript 템플릿도 build 스크립트에서 `tsc -b`를 먼저 돌리고 `vite build`를 한다. 몽글도 처음엔 이렇게 되어 있었다.

```jsonc
// package.json
"scripts": {
    "build": "tsc -b && vite build", // 타입 검사는 사실상 여기서 했다
    "typecheck": "tsc --noEmit",
    // ...
}
```

그런데 이후 다른 작업 커밋에 섞여서 build 스크립트에서 `tsc -b`가 빠졌다. build가 `vite build`만 돌게 되면서 타입 검사는 `typecheck` 스크립트 하나에만 남게 됐다. AI 작업 규칙 문서에는 여전히 `npm run build`가 타입 검증 기준이라고 적혀 있었다. 그러니 규칙대로 build로 검증해도 타입은 아무도 보지 않는 셈이었다.

## typecheck도 아무 파일을 검사하지 않고 있었다

남은 `typecheck`도 문제였다. 몽글의 루트 `tsconfig.json`은 Vite 템플릿처럼 직접 검사할 파일 목록(`files`)이 비어 있다. 대신 src와 `vite.config.ts`, e2e 스펙을 각각 맡은 설정 파일 세 개를 references 항목으로 연결만 해 둔다.

```jsonc
// tsconfig.json
{
    "files": [], // 루트에는 직접 검사할 파일이 없다
    "references": [
        { "path": "./tsconfig.app.json" }, // src
        { "path": "./tsconfig.node.json" }, // vite.config.ts
        { "path": "./e2e/tsconfig.json" } // e2e 스펙
    ]
    // ...
}
```

`tsc`는 `--build`(`-b`)를 붙이지 않으면 references로 연결된 설정 파일을 따라가서 검사하지 않는다([TypeScript 문서](https://www.typescriptlang.org/docs/handbook/project-references.html)). 그래서 `tsc --noEmit`은 루트 `tsconfig.json` 하나만 읽는다. 그런데 루트에는 검사할 파일이 0개라서 아무것도 검사하지 않은 채 성공으로 끝난다. references가 하나라도 있으면 `files`가 비어 있어도 에러가 아니라서 경고도 나오지 않는다.

같은 구조로 최소 예제를 만들고 일부러 타입 에러를 한 줄 넣어보면 차이가 바로 보인다.

```ts
// src/main.ts
const count: number = '3'; // 일부러 넣은 타입 에러
```

```
$ npx tsc --noEmit
$ echo $?
0

$ npx tsc --noEmit --listFilesOnly   # 검사한 파일 목록인데 아무것도 안 나온다

$ npx tsc -b
src/main.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
$ echo $?
1
```

`typecheck`는 build에 `tsc -b`가 들어 있던 때부터 루트 `tsconfig.json`만 읽고 있었다. 그동안은 build가 타입 검사를 대신하고 있어서 `typecheck`가 아무것도 안 한다는 게 드러나지 않았던 것이다. 그러다 build에서 `tsc -b`가 빠지자 저장소의 어떤 명령도 타입을 검사하지 않는 상태가 됐다.

| 명령 | 읽는 설정 | 타입 검사 |
| --- | --- | --- |
| `vite build` | `vite.config.ts` | 안 한다. 타입을 지우고 변환만 한다 |
| `tsc --noEmit` | 루트 `tsconfig.json` 하나 | 루트에 파일이 없으면 아무것도 안 한다 |
| `tsc -b` | 루트와 references로 연결된 설정 전부 | 한다 |

그래서 `typecheck`를 `tsc -b`로 바꿨다. AI 작업 규칙 문서도 build는 번들만 만들고 타입 검증은 `typecheck`로 한다고 고쳤다.

```jsonc
// package.json
"scripts": {
    "build": "vite build", // 번들만 만든다. 타입은 안 본다
    "typecheck": "tsc -b", // references를 전부 따라가서 검사한다
    // ...
}
```

바꾸자마자 그동안 안 잡히던 타입 에러 3건이 나왔다. 쓰지 않는 변수가 있었고, 테스트 객체의 타입과 mock 함수의 시그니처도 틀려 있었다.

## 고친 typecheck도 아무도 돌리지 않았다

`typecheck`는 고친 다음에도 각자 로컬에서 직접 실행해야 했다. 머지 전에 돌려야 한다는 규칙은 문서에만 있었고, 실제로 머지를 막는 장치는 없었다.

모바일 에디터 미리보기에 이벤트 대사가 안 나오던 버그도 이렇게 머지됐다. 이벤트 대사 필드를 배열로 바꾼 커밋은 미리보기 한 군데를 안 고친 상태였다. build는 `vite build`만 돌기 때문에 이 커밋도 통과했고, `typecheck`는 머지 전에 아무도 돌리지 않았다.

그래서 사람이 기억해서 돌리는 대신 GitHub Actions가 PR과 qa 브랜치 push마다 검사를 돌리게 했다. 처음에는 검사 네 개를 `&&`로 이어 둔 `verify` 스크립트를 로컬과 똑같이 CI에서 실행했다.

```jsonc
"verify": "eslint . && prettier --check . && tsc -b && vitest run"
```

## CI 첫 실행에서는 실패 하나가 다른 실패를 가렸다

CI는 첫 실행부터 실패했다. 원인은 e2e 스펙 두 개에서 난 타입 에러였다. [AI QA 글](/posts/ai-qa-trust/)에서 근거 없이는 확정 판정을 못 만들게 하려고 `confirmed()` 함수가 근거를 필수 인자로 받게 했다. 그런데 이 스펙 두 개가 근거 인자를 빠뜨리고 있었다.

근데 이 스펙 두 개를 고치고 나니 이번엔 vitest에서 테스트 6건이 실패했다. SQLite 서비스에 메서드를 하나 추가한 커밋이 통합 테스트의 mock을 빠뜨리는 바람에 이 6건은 스펙을 고치기 전부터 이미 깨져 있었다. `verify`처럼 `&&`로 이어 둔 명령은 앞이 실패하면 뒤를 실행하지 않는다. 그래서 CI에서 `tsc -b`가 실패하는 동안 vitest는 실행되지 않았고, 그 사이 깨진 테스트도 보이지 않았던 것이 문제였다.

이후 CI에서는 검사를 단계별로 나눠서 한 단계가 실패해도 나머지 검사는 끝까지 돌게 바꿨다. 성공인지 실패인지는 마지막 단계에서 한꺼번에 판정한다.

```yaml
- name: Type check (tsc -b)
  id: tsc
  continue-on-error: true # 실패해도 다음 검사로 넘어간다
  run: npx tsc -b

- name: Test (vitest)
  id: test
  continue-on-error: true
  run: npx vitest run --maxWorkers="$(nproc)"

# ...

- name: Fail if not auto-fixed
  if: >-
      ((steps.eslint.outcome == 'failure' || steps.prettier.outcome == 'failure'
      || steps.tsc.outcome == 'failure' || steps.test.outcome == 'failure'
      || steps.build.outcome == 'failure') && ...)
  run: exit 1 # 판정은 여기서 한 번에 한다
```

실패 알림에도 실패한 검사 이름을 모아서 보내게 했다. 이제 `tsc`와 `vitest`가 같이 실패하면 알림 한 번에 둘 다 보인다.

## 배운점

타입 검사 명령이 있다는 것과 그 명령이 실제로 파일을 검사한다는 건 별개였다.

결국 검사가 통과했다는 결과보다 그 검사가 무엇을 읽고 무엇을 실패로 보는지를 먼저 확인해야 하는 것 같다.
