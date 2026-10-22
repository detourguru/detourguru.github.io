+++
date = '2026-10-22T00:00:00+09:00'
draft = true
title = '타임아웃이 난 요청을 다시 보내도 될까?'
description = '요청이 타임아웃 나면 보낸 쪽은 그 요청이 처리됐는지 알 수 없다. 회전문에서 공연 정보를 읽기만 하는 요청은 그대로 다시 보내고, 캐스팅보드 저장은 분석 결과 id와 이미지 해시로 이미 저장한 요청을 알아본다. 이슈를 만든 뒤에야 번호를 기록하는 버그 제보 크론은 송장 발급과 같은 구조라서 시작 상태를 먼저 남기고 다시 만들기 전에 조회해야 한다.'
tags = ["설계", "테스트"]
+++

<!-- 저자 확인 필요:
- 송장 질문을 계기로 써도 되는지, 질문 문구가 실제로 들은 것과 맞는지
- 버그 제보 크론은 수정 전. 고친 뒤 이 섹션을 고친 방법과 검증으로 바꿀지, 수정 전에 발행할지
- 배운점의 다음 할 일(버그 제보 크론 수정, #126)이 실제 계획과 맞는지
- 회사 서비스 결제 문단(동료 코드)의 추상화 수준
- 서비스 설명 문장에 다수결 초안 발행 후 링크
- 썸네일 크론 초안과 Vercel 크론 중복 호출 문서 인용이 겹침
- 두 번째 태그, 배운점 문장
- 뺀 문장: KOPIS 400 재시도 이유(주석에만 있음)
- 결제 문단의 "맞춘다"를 "주문 상태를 맞춘다"로 풀었는데 실제 동작과 맞는지
- 크론 재처리에서 조건부 update로 가져가는 시점이 목록 조회 전인지, 이슈를 다시 만들기 직전인지
-->

얼마 전에 이런 질문을 받았다.

> 외부 API로 송장 번호를 발급받는데 타임아웃이 났다. 다시 요청하면 중복 발급될 수 있다면 어떻게 막을까?

타임아웃이 났다고 요청이 실패했다고 단정할 수는 없다. 요청이 상대 서버에 닿지 못했을 수도 있지만, 송장 번호는 이미 발급됐고 응답만 돌아오지 못했을 수도 있다. 보낸 쪽에서는 둘 중 어느 경우인지 알 수 없으니 그대로 다시 보내면 송장이 두 번 발급될 수 있다.

내 개인 프로젝트인 [회전문](https://hoejeonmun.vercel.app/)은 사용자가 공연 캐스팅보드(회차마다 나오는 배우를 적은 표) 이미지를 올리면 AI가 분석해 회차별 캐스팅을 저장하는 서비스다. 여기서도 응답을 못 받는 요청이 생긴다. 그런데 어떤 요청은 그냥 다시 보내도 되고, 어떤 요청은 다시 보내면 같은 일이 두 번 일어난다.

## 공연 정보 조회는 타임아웃이 나면 다시 보낸다

회전문은 공연 정보를 공연예술통합전산망인 KOPIS의 API에서 가져온다. KOPIS 요청에는 [한 번 보낼 때 5초, 다시 보낸 요청까지 합친 조회 한 번에 10초 제한을 걸었다](https://github.com/detourguru/hoejeonmun/commit/11302f2). 타임아웃이나 네트워크 오류가 나거나 429나 5xx 응답이 오면 다시 보낸다.

```ts
const deadline = Date.now() + KOPIS_TOTAL_TIMEOUT_MS; // 지금부터 10초

for (let attempt = 1; ; attempt++) {
  try {
    // ...
    const response = await fetch(url, {
      // ...
      signal: AbortSignal.timeout(timeout), // 5초와 남은 시간 중 짧은 것
    });
    // ...
  } catch (error) {
    const delay = KOPIS_RETRY_DELAY_MS * attempt + Math.random() * 200;

    if (
      attempt >= KOPIS_MAX_ATTEMPTS || // 4번까지
      !isRetryable(error) || // 다시 보낼 에러만
      Date.now() + delay >= deadline // 기다리다 10초를 넘기면 그만
    ) {
      throw error;
    }

    await sleep(delay); // 다시 보낼수록 오래 기다린다
  }
}
```

KOPIS가 5초 안에 응답하지 않으면 `AbortSignal.timeout`이 요청을 끊는다. 그러면 catch에서 400~600ms를 기다렸다가 다시 보낸다. 이때 10초 중 남은 시간은 4.5초 정도라서 두 번째 요청은 5초가 아니라 그만큼만 기다린다. 두 번째도 끊기면 10초를 다 써서 더 보내지 않는다. 그러니까 타임아웃이 계속 나면 최대 횟수인 4번까지 가지 않고 2번 보낸 뒤 멈춘다. 이 동작은 [테스트](https://github.com/detourguru/hoejeonmun/commit/452aa8f)로 남겨뒀다.

이렇게 다시 보내도 되는 건 KOPIS 요청이 공연 정보를 읽기만 하는 GET이기 때문이다. 첫 요청이 사실은 처리됐더라도 같은 정보를 한 번 더 받을 뿐이라 문제가 없다. 그런데 무언가를 만드는 요청은 첫 요청이 이미 처리됐다면 다시 보낸 만큼 더 만들어진다.

## 캐스팅보드 저장은 이미 저장한 요청인지 먼저 확인한다

캐스팅보드 이미지를 올리면 서버가 분석한 결과를 보관하고 그 id인 `parseId`를 돌려준다. 사용자가 분석 결과를 확인하는 화면에서 저장을 누르면 이 `parseId`로 저장 요청을 보낸다. 서버는 저장할 때마다 `uploads` 테이블에 행을 하나 만들고, 분석 결과의 `upload_id`에 그 행의 id를 적어 둘을 연결한다. 그래서 저장 요청이 오면 이 분석 결과가 이미 `uploads` 행과 연결돼 있는지부터 확인한다.

```ts
const access = checkParseResultAccess(
  await getParseResult(admin, parseId),
  { userId, showId, now: Date.now() },
);

if (!access.ok) return fail(access.status, access.message);
// ...
const result = await saveCastingBoard({ /* ... */ });

await linkParseResultToUpload(admin, parseId, result.uploadId); // 저장이 끝난 뒤에 연결한다

// checkParseResultAccess
if (row.upload_id !== null) {
  return { ok: false, status: 409, message: "이미 저장한 분석 결과예요." };
}

// linkParseResultToUpload: 연결이 실패해도 로그만 남긴다
if (error) console.error("파싱 결과와 업로드 연결 실패", error);
```

그런데 연결은 저장이 끝난 뒤에 따로 한다. 그래서 같은 `parseId`로 저장 요청 두 개가 거의 동시에 들어오면 둘 다 아직 연결되지 않은 분석 결과를 읽고 확인을 통과한다. 연결이 실패해도 로그만 남기고 성공 응답을 보낸다. 이때 분석 결과는 연결되지 않은 채로 남아서 그 뒤에 같은 `parseId`로 온 요청도 확인을 통과한다.

이렇게 확인을 통과한 요청은 이미지 해시에서 한 번 더 막힌다. 저장할 때는 이미지마다 SHA-256 해시를 구해 `upload_images` 테이블에 넣는다. 같은 공연에 같은 해시를 두 번 넣으면 DB가 거절하도록 유니크 인덱스를 걸어뒀다([#25 같은 캐스팅보드 이미지 재업로드 차단](https://github.com/detourguru/hoejeonmun/issues/25)).

```sql
create unique index upload_images_show_hash_idx
  on upload_images (show_id, image_hash)
  where show_id is not null and image_hash is not null;
```

```ts
// uploads 행을 만든 다음 upload_images를 넣다가 실패하면
if (uploadImagesError) {
  if (uploadImagesError.code === DUPLICATE_KEY) // 23505는 유니크 인덱스에 걸렸다는 PostgreSQL 에러 코드
    throw new Error("이미 등록된 캐스팅보드예요.");
  // ...
}
```

이렇게 저장 도중 에러가 나면 `saveCastingBoard`의 catch가 방금 만든 `uploads` 행을 지운다. 분석 단계에서도 Gemini를 부르기 전에 같은 해시가 있는지 조회하긴 한다. 그런데 분석한 뒤에 저장된 이미지까지 막는 건 이 인덱스다.

예를 들어 같은 캐스팅보드 이미지를 두 사람이 비슷한 시간에 올렸다고 해보자. 아직 아무도 저장하기 전에 둘 다 분석했으니 분석 단계의 해시 조회는 통과한다. `parseId`도 서로 달라서 연결 확인도 통과한다. 그래도 `upload_images`에 먼저 넣은 요청만 저장된다. 뒤의 요청은 23505 에러(유니크 인덱스 위반)로 실패해서 자기가 만든 `uploads` 행을 지운다.

### 다시 누른 사용자는 저장 결과 대신 409를 받는다

저장 요청에 에러 응답이 오면 확인 화면이 그대로 남아 있어서 사용자는 같은 `parseId`로 저장을 다시 누를 수 있다. 그런데 서버에서는 첫 요청이 저장까지 끝났고 사용자만 에러를 받았다면, 다시 보낸 요청이 받는 응답은 두 가지로 나뉜다.

첫 요청이 분석 결과 연결까지 끝냈다면 다시 보낸 요청은 409를 받고 확인 화면에 `이미 저장한 분석 결과예요.`가 뜬다. 연결이 실패했다면 다시 보낸 요청은 연결 확인을 통과한 뒤 이미지 해시에서 막힌다. 그런데 저장 API 라우트는 이 중복 에러를 다른 에러와 구분하지 않아서 `저장하지 못했어요. 잠시 후 다시 시도해 주세요.`를 보낸다. 캐스팅보드는 이미 저장돼 있는데 다시 시도하라는 안내를 받는 것이다.

어느 경우든 캐스팅보드가 두 번 저장되지는 않는다. 하지만 다시 보낸 요청은 첫 요청이 받았어야 할 저장 결과를 받지 못하니, 이 저장 요청이 멱등하지는 않은 거였다.

> 같은 요청을 여러 번 보내도 한 번 보낸 것과 결과가 같으면 그 요청을 멱등하다고 한다.

다시 보낸 요청에도 첫 요청과 같은 결과를 주려면 서버가 저장 결과를 `parseId`와 같이 보관해뒀다가 409 대신 그 결과를 돌려줘야 한다.

### 회차는 몇 번을 저장해도 같은 id가 나온다

회차는 공연과 날짜, 시각이 같으면 같은 회차다. 그래서 회차를 담는 `slots` 테이블에는 이 세 값에 유니크 키를 걸었다. 저장할 때는 이미 있는 회차는 건너뛰고 없는 회차만 새로 만드는 upsert로 넣는다.

```ts
const { error: slotError } = await admin.from("slots").upsert(
  performances.map(({ date, time }) => ({ show_id: showId, date, time })),
  { onConflict: "show_id,date,time", ignoreDuplicates: true }, // 이미 있는 회차는 건너뛴다
);
// ...
const { data: slots, error: slotSelectError } = await admin
  .from("slots")
  .select("id, date, time")
  .eq("show_id", showId)
  .gte("date", dates[0])
  .lte("date", dates[dates.length - 1]); // 새 회차와 원래 있던 회차를 같이 다시 읽는다
```

새 캐스팅보드에 9월 28일 19:30과 29일 14:00 공연이 적혀 있고, 28일 회차는 이미 저장돼 있다고 해보자. upsert는 28일 회차를 건너뛰고 29일 회차만 만든다. 그다음 28일부터 29일까지 회차를 다시 읽어서 날짜와 시각으로 id를 찾는다. 그러니까 28일에는 원래 있던 id가 그대로 나온다.

회차는 `uploads`가 아니라 공연에 딸린 행이다. 그래서 저장이 중간에 실패해 `uploads` 행을 지워도 회차는 그대로 남는다. 회차를 그냥 insert했다면 다시 저장할 때 남아 있던 회차가 유니크 키에 걸려 실패했을 것이다. 하지만 upsert는 이미 있는 회차를 건너뛰니까 문제없이 이어서 저장할 수 있다.

## 버그 제보 크론은 송장 발급과 같은 구조다

회전문에는 앱에서 받은 버그 제보를 하루 한 번 GitHub 이슈로 옮기는 크론이 있다([#62 버그 제보 GitHub 이슈 자동 생성](https://github.com/detourguru/hoejeonmun/issues/62)).

```ts
for (const report of reports) { // github_issue_number가 null인 제보들
  try {
    // ...
    const issueNumber = await createGithubIssue( // GitHub에 이슈를 만드는 POST
      buildTitle(report.message),
      buildBody(report, imageUrls),
    );

    const { error: updateError } = await admin
      .from("bug_reports")
      .update({ github_issue_number: issueNumber }) // 번호는 이슈를 만든 다음에 기록한다
      .eq("id", report.id);

    if (updateError) throw updateError;
    // ...
  } catch (err) {
    // ... 실패 목록에 넣고 다음 제보로 넘어간다
  }
}
```

크론이 이슈를 만드는 POST와 번호를 기록하는 update 사이에서 멈추면 GitHub에는 이슈가 있는데 제보에는 번호가 없는 상태가 된다. update가 실패하거나 이슈는 만들어졌는데 응답이 오다가 끊기면 이렇게 멈출 수 있다. `createGithubIssue`의 `fetch`에는 시간 제한도 없다. 그래서 응답이 늦으면 함수가 60초 실행 제한(`maxDuration = 60`)에 걸려 멈출 때까지 기다릴 수도 있다.

실패한 크론을 Vercel이 [다시 실행해주지 않기 때문에](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-error-handling) 남은 제보는 다음 날 실행이 이어서 처리한다. 그런데 다음 날 실행은 번호가 비어 있는 이 제보를 처음 보는 제보로 읽고 이슈를 하나 더 만든다.

게다가 Vercel [크론 문서](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-delivery-and-idempotency)에는 같은 시각에 잡힌 실행이 가끔 두 번 돌 수 있다고 나와 있다. 두 실행이 동시에 돌면 둘 다 같은 제보를 읽고 이슈를 하나씩 만든다.

### 시작 상태를 먼저 남기고 다시 만들기 전에 조회하자

GitHub [이슈를 만드는 API](https://docs.github.com/en/rest/issues/issues#create-an-issue)는 제목, 본문, 라벨 같은 값만 받고 멱등 키(받는 쪽이 다시 보낸 요청을 알아보게 하는 값)는 받지 않는다. 그래서 이슈를 이미 만들었는지는 크론이 직접 확인해야 한다.

실행이 두 번 돌아도 제보 하나는 한 실행만 가져가게 하려면 제보에 시작 시각 컬럼을 두면 된다. POST를 보내기 전에 이 컬럼이 비어 있을 때만 값을 채우는 조건부 update를 먼저 한다. 다른 실행이 먼저 값을 채웠다면 이 update는 바꿀 행이 없다. 그래서 update로 행을 실제로 바꾼 실행만 POST를 보낸다. 함수가 60초 제한에 걸려 멈추기 전에 요청을 먼저 끊도록 POST에는 `AbortSignal.timeout`도 건다.

시작 시각은 있는데 이슈 번호가 없는 제보는 이슈가 만들어졌는지 알 수 없는 상태다. 이런 제보는 바로 다시 만들지 않고 [저장소 이슈 목록 API](https://docs.github.com/en/rest/issues/issues#list-repository-issues)로 먼저 조회한다. 이슈 본문에는 `buildBody`가 넣은 `제보 번호: {id}` 줄이 있다. 그래서 목록 API에서 `creator` 조건으로는 크론이 쓰는 토큰의 계정이 만든 이슈만, `since` 조건으로는 시작 시각 이후에 바뀐 이슈만 받는다. 그리고 받은 이슈 본문에 이 줄이 있는지 보면 된다.

이 줄이 있는 이슈를 찾으면 그 번호를 제보에 기록하고, 없을 때만 이슈를 다시 만든다. 이렇게 다시 처리할 때도 처음처럼 조건부 update로 제보를 먼저 가져간다. 이번에는 시작 시각이 비어 있을 때가 아니라 읽어둔 시작 시각이 그대로일 때만 시작 시각을 바꾼다.

Vercel 크론 문서도 동시에 도는 실행은 락으로 막고, 두 번 돌거나 빠진 실행은 다시 처리해도 안전하게 만들라고 권한다. 여기서는 조건부 update가 락 역할을 한다. 그리고 이슈를 다시 만들기 전에 제보 번호로 먼저 조회하니까 다시 처리해도 안전하다.

회사 서비스의 결제도 요청 전에 주문을 대기 상태로 저장해둔다. 결제 응답을 못 받아도 주문을 실패로 처리하지 않는다. 그 대신 주기적으로 도는 작업이 결제사에 거래 상태를 조회해서 주문 상태를 맞춘다.

송장 발급도 같은 방법으로 중복 발급을 막을 수 있을 것 같다. 발급을 요청하기 전에 주문마다 요청 상태를 남긴다. 타임아웃이 나면 그 상태로 두고, 다시 발급하기 전에 주문번호로 이미 발급된 송장이 있는지부터 조회한다. 외부 API가 멱등 키를 받는다면 주문번호로 만든 같은 키로 다시 보내기만 하면 되니 어렵지 않다. 멱등 키도 없고 발급된 송장을 조회할 방법도 없다면 자동으로 다시 보내지 말고 사람이 확인할 상태로 남겨둬야 할 것 같다.

## 배운점

송장 질문을 회전문 코드에 적용해보니 그냥 다시 보내도 되는 요청은 KOPIS 조회처럼 읽기만 하는 요청이었다.

결국 타임아웃이 난 요청을 다시 보내도 되는지는 받는 쪽이 이미 처리한 요청을 알아볼 수 있는지에 달린 것 같다. 다음에는 버그 제보 크론에 시작 상태와 조회를 붙이려고 한다. 저장 도중 실패하면 회차처럼 `uploads`에 딸리지 않은 행이 남는 문제도 [#126 여러 테이블에 걸친 쓰기를 트랜잭션으로 묶기](https://github.com/detourguru/hoejeonmun/issues/126) 이슈에서 이어서 볼 생각이다.
