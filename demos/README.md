# 데모

독자가 글을 이해하게 돕는 시각 도구다. 보자마자 문제가 보여야 하는 것이 목적이다. 작성 시 예시는 `majority-vote`(스위치 하나)와 `ai-qa-trust`(단계 있음).

## 규칙

1. 주요 현상 하나를 가장 작은 예로 보여준다. 글의 측정값과 관련한 모든 케이스를 다 보여줄 필요는 없다.
2. 전후 화면 모양은 동일한 UIUX를 유지한다.
3. 독자가 읽는 화면에 제작 메모를 남기지 않는다.
4. 표 아래에 지금 상태가 뜻하는 바를 한 문장으로 적는다.
5. 여러 스탭으로 이루어진 현상의 경우 따라 하기 등으로 독자가  직접 체험하게 돕는다.

## 문구

데모에 작성되는 문장은 `docs/tone-summary.md` 톤 가이드를 참조한다.

## 만들기

- `demos/<name>/`에 `index.html`, `README.md`, `src/main.tsx`, `src/App.tsx`, `src/samples.ts`, `src/styles.css`. `main.tsx`는 `majority-vote/src/main.tsx`를 복사한다.
- `vite.config.ts`의 `rollupOptions.input`과 `tsconfig.json`의 `include`에 등록한다.
- 색은 `shared/base.css` 토큰만 쓴다(`--primary`, `--secondary`, `--border`, `--code-bg`, `--ok`, `--bad`, `--warn`). 공용 클래스 `.page`, `.desc`, `.switch`, `.guide`, `.footnote`를 먼저 쓰고 데모 CSS에는 남는 것만 쓴다.
- 스위치 버튼은 `aria-pressed`, 결과 문장은 `aria-live="polite"`.
- 최상위는 `<main className="page">` 하나. 고정 높이를 주지 않는다. 쇼트코드가 `#root` 자식 높이로 iframe을 맞춘다.
- 글에는 `{{< demo name="<name>" height="auto" >}}`를 그 현상을 설명한 섹션 바로 뒤에 넣는다.
- README는 한 문단 소개, 글 링크, 재현하는 현상, 옮긴 코드와 뺀 것, 알아둘 점. 라벨은 화면과 같게 유지한다.

## 확인

`cd demos && npm run build`(tsc 포함) 뒤 `npx vite preview --port 5191`로 `/demos/<name>/`을 연다. 720px과 375px, `?theme=dark`를 본다. `static/demos/`는 커밋하지 않는다(CI가 빌드한다).
