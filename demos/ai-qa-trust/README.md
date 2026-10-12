# AI QA 판정 게이트 데모

AI가 `확정`한 결함이라도 근거가 이번 실행의 서버 로그와 맞지 않으면 일감으로 올리지 않는 게이트를, 직접 눌러 보며 확인할 수 있게 만든 데모다.

- 글: [AI가 돌리는 QA를 팀에서 믿고 쓸 수 있을까?](/posts/ai-qa-trust/)
- 데모: `/demos/ai-qa-trust/`

## 재현하는 현상

LLM은 판정에 `확정`을 붙이면서 근거를 비우거나, 없는 로그 id를 인용하거나, 실제 응답에 없는 값을 지어낼 때가 있다. 글에 나온 `Judgement` 타입은 `evidence: string | null`이라서 이런 판정도 그대로 통과하는 것이 문제였다.

로케이터 하나로 내린 오탐도 같이 넣었다. 공유 버튼은 라벨만 바뀌어서 `공유하기` 링크가 됐는데, 버튼 로케이터 하나로 못 찾았다는 사실만 근거로 들면 멀쩡한 기능을 없다고 확정하게 된다.

데모는 도현 여정을 작은 가짜 앱에서 실제로 돌려 증거 JSON을 만들고, 그 위에 LLM 판정 샘플을 얹어서 게이트를 통과한 판정만 일감 후보로 남긴다. 앱에는 진짜 버그 2개(권한 누락, 연타 이중 결제)와 버그가 아닌 함정 1개(공유 라벨 변경)가 들어 있다.

## 고친 방법

화면의 AI QA 돌리기까지가 AI가 확정한 목록을 그대로 믿는 상태이고, 근거 대조하기를 누르면 게이트가 돈다.

| | 글의 타입 | 이 데모 |
| --- | --- | --- |
| 타입 (`judgement.ts`) | `evidence: string \| null`이라 `{ grade: '확정', evidence: null }`도 만들 수 있다 | `확정`만 `evidence: [Evidence, ...Evidence[]]`를 갖는 판별 유니온. 근거는 `{ kind: 'log', id, quote }`나 `{ kind: 'dom', selector, observed }` 구조체다 |
| 런타임 (`gate.ts`) | 검사 없음 | zod로 모양을 다시 검사하고 이번 실행 로그와 셀렉터에 대조한다 |
| 진입점 검사 (`dom.ts`) | 로케이터 하나 | `expectAbsent`는 로케이터 2개 이상을 받고 근거가 있어야 `확정`으로 올린다 |

`judgement.typetest.ts`는 번들에 들어가지 않는 타입 테스트다. 근거가 null이거나 빈 배열이거나 문자열인 `확정`이 컴파일되면 `@ts-expect-error`가 쓰이지 않게 되니까 `tsc`가 실패한다.

## 게이트가 거르는 기준

LLM 출력은 타입 검사를 거치지 않기 때문에 게이트는 먼저 `schema.ts`의 zod 스키마로 모양을 다시 검사한다. `확정`인데 근거가 없거나 비었거나 문자열이면 여기서 걸리고, `관찰`이나 `미확인`에 근거를 붙여도 형식 오류로 본다.

모양이 맞으면 근거를 이번 실행과 대조한다. 로그 근거는 그 id가 이번 실행 로그에 있어야 하고, 인용한 문구가 그 응답의 상태 코드와 본문에 그대로 들어 있어야 한다. 화면 근거는 이번 실행에서 실제로 쓴 로케이터여야 하는데, 그 로케이터가 0개를 찾았는데 같은 대상을 다른 로케이터가 찾았다면 모순으로 본다. 화면 관찰만으로는 서버 쪽 버그를 짚을 수 없어서 유효한 로그 근거가 하나도 없으면 `확정`할 수 없게 했다.

하나라도 어긋나면 `미확인`으로 내리고 이유를 적는다. 일감 후보는 게이트를 통과한 `확정`에서만 나온다. 빨간 항목을 열면 AI가 댄 근거와 실제 기록을 나란히 보여 주고, `gate.ts` 원본에서 그 판정을 내린 줄을 찾아 같이 띄운다.

가짜 서버는 실행마다 새로 만들고 `log#1`부터 번호를 매긴다. 응답을 요청 시점에 바로 기록하고 전달만 120ms 늦추니까 같은 버그 조합이면 연타 순서와 로그 id가 매번 같다. 샘플이 어떤 로그를 보고 쓰였는지는 `id method path status`로 만든 지문으로 확인하고, 지문이 다르면 샘플을 보여 주지 않는다.

버그 조합별 게이트 결과는 다음과 같다. 조합 키는 권한 누락, 연타 결제, 공유 라벨 순서다.

| 조합 | 게이트 결과 | 일감 후보 |
| --- | --- | --- |
| 000 | 확정 2건 중 0건 통과 (2건 강등) | 없음 |
| 100 | 확정 1건 중 1건 통과 | 권한 누락 |
| 010 | 확정 1건 중 1건 통과 | 중복 결제 |
| 001 | 확정 1건 중 0건 통과 (1건 강등) | 없음 |
| 110 | 확정 3건 중 2건 통과 (1건 강등) | 권한 누락, 중복 결제 |
| 101 | 확정 2건 중 1건 통과 (1건 강등) | 권한 누락 |
| 011 | 확정 3건 중 1건 통과 (2건 강등) | 중복 결제 |
| 111 | 확정 5건 중 2건 통과 (3건 강등) | 권한 누락, 중복 결제 |

## 파일

| 파일 | 역할 |
| --- | --- |
| `src/App.tsx` | 화면과 따라 하기. QA 실행, 근거 대조, 빨간 항목 열기 |
| `src/fakeServer.ts` | 메모리 가짜 서버. 요청마다 `log#N`을 남긴다 |
| `src/targetApp/` | 남의 콘텐츠 상세 화면. 로딩과 구매는 effect가 아니라 명령형 컨트롤러에 있다 |
| `src/dom.ts` | `getByRole`을 흉내 낸 로케이터와 `expectAbsent` |
| `src/runner.ts` | 도현 여정 7단계. 단계와 로케이터 결과, 로그 id를 증거 JSON으로 묶는다 |
| `src/schema.ts` | zod 스키마. Worker도 같은 파일을 쓴다 |
| `src/judgement.ts` | `Judgement` 타입과 `observed`, `unverified`, `confirmed` 헬퍼 |
| `src/judgement.typetest.ts` | 잘못된 `확정`이 컴파일되지 않는지 보는 타입 테스트 |
| `src/gate.ts` | 모양 검사와 대조를 하는 게이트 |
| `src/Finding.tsx` | 근거 대조표와 판정을 내린 `gate.ts` 줄 표시 |
| `src/samples.ts`, `src/samples.json` | 버그 조합 8개별 LLM 판정 샘플과 로그 지문 |
| `src/liveJudge.ts` | `VITE_QA_WORKER_URL`이 있을 때 Worker에 판정을 요청하는 함수 |
| `worker/` | Cloudflare Worker와 녹화 스크립트, 조합별 증거 JSON |

## 알아둘 점

`src/samples.json`은 실제 LLM 실행 기록이 아니고, 게이트가 걸러야 할 실패를 일부러 섞어서 손으로 쓴 샘플이다. 근거가 없는 `확정`과 없는 로그 id(`log#99`)를 인용한 `확정`이 들어 있다. 실제 응답에 없는 값(`"balance":-200`)을 인용한 `확정`과 로케이터 하나로 못 찾았다는 것만 근거로 든 공유 오탐도 있다. 권한 누락과 중복 결제는 실제 로그 id를 정확히 인용한다. 화면에도 샘플 응답이라고 적어 뒀다. 지문은 Playwright로 실제 러너를 돌려 얻은 `worker/evidence/evidence-<조합>.json`에서 만들었다.

화면은 버그 3개를 모두 켠 조합 111만 돌리고, 나머지 조합의 샘플은 녹화와 검증에만 쓴다. `liveJudge.ts`는 Worker를 배포하면 화면에 다시 붙일 예정이라 지금은 연결돼 있지 않다.

게이트는 인용한 근거가 실제로 있는지를 보고, 그 근거가 버그를 제대로 설명하는지는 판단하지 않는다. 앱 동작이 바뀌어 로그가 달라지면 지문이 맞지 않아 샘플이 숨겨지기 때문에 증거 JSON을 다시 만들고 다시 녹화해야 한다.

## Worker 배포와 샘플 녹화

Worker는 아직 배포하지 않았다. `worker/src/index.ts`는 `POST { scenario, evidence }`만 받는다. `scenario`는 허용 목록(`dohyun-foreign-content`)에 있어야 하고 `evidence`는 `src/schema.ts`의 스키마를 통과해야 하며, 본문은 20KB까지다.

클라이언트가 프롬프트 문장을 보내면 Worker를 아무 용도로나 쓸 수 있으니까 프롬프트는 Worker 안에서 만든다. Anthropic Messages API(`claude-haiku-4-5-20251001`, `max_tokens: 1500`)는 `fetch`로 부르고 `output_config.format`으로 판정 배열 모양을 강제한다. 다만 근거 id가 실제로 있는지 같은 규칙은 JSON 스키마로 표현할 수 없어서 API 쪽 스키마는 느슨하게 두고 브라우저 게이트가 맡는다. `stop_reason`이 `refusal`이나 `max_tokens`면 실패로 돌려준다.

CORS는 `https://detourguru.github.io`와 `localhost`, `127.0.0.1`만 허용한다. IP당 분당 요청 수(`PER_IP_PER_MINUTE` 기본 5)와 하루 요청 수(`DAILY_CAP` 기본 200)도 제한하는데 이 카운터는 isolate 메모리에 있어서 isolate가 다시 뜨거나 여러 개 뜨면 공유되지 않는다. 그래서 실제 비용 상한은 Anthropic 콘솔의 월 지출 한도로 건다.

### 배포 절차

1. Cloudflare 계정을 만들고 `npx wrangler login`으로 로그인한다.
2. Anthropic 콘솔에서 이 데모 전용 API 키를 만들고 월 지출 한도를 낮게 건다.
3. `cd demos/ai-qa-trust/worker && npx wrangler secret put ANTHROPIC_API_KEY`로 키를 넣는다. 키는 `wrangler.toml`에 쓰지 않는다.
4. 필요하면 `wrangler.toml`의 `DAILY_CAP`과 `PER_IP_PER_MINUTE`을 바꾼다.
5. `npx wrangler deploy`로 배포하고 나온 주소를 `demos/.env.production.local`에 `VITE_QA_WORKER_URL=https://ai-qa-trust-judge.<계정>.workers.dev`로 넣는다. Worker 주소는 공개돼도 된다.

wrangler는 이 저장소 의존성에 없어서 `npx wrangler`로 그때그때 받아 쓴다. Worker는 `../../src/schema.ts`와 `zod`를 import하고 wrangler가 같이 번들한다. 타입 검사는 demos 폴더에서 `npx tsc --noEmit -p ai-qa-trust/worker/tsconfig.json`으로 한다.

### 샘플을 실제 녹화본으로 바꾸기

1. `worker/.dev.vars`에 `ANTHROPIC_API_KEY=...`를 쓴다. 이 파일은 `worker/.gitignore`에 들어 있다.
2. `cd demos/ai-qa-trust/worker && npx wrangler dev`로 띄운다. 기본 주소는 `http://127.0.0.1:8787`이다.
3. 다른 터미널에서 `node --experimental-strip-types record-samples.ts http://127.0.0.1:8787`을 실행한다. Node 22.6 이상이 필요하다.
4. 스크립트가 `worker/evidence/`의 증거 8개를 하나씩 보낸다. 유료 호출 8번이고, 분당 제한에 걸리지 않게 사이마다 13초씩 쉰다. 끝나면 `src/samples.json`이 `source: "recorded"`로 바뀌고 화면의 샘플 안내 문구가 사라진다.
