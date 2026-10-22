+++
date = '2026-10-22T00:00:00+09:00'
draft = true
title = '큐 서버 없이 크론으로 썸네일 빠짐없이 만들기'
description = '내 개인 프로젝트 회전문의 목록 화면 포스터를 썸네일로 바꾸면서 하루 한 번, 60초 안에 끝나야 하는 크론에 할 일이 생겼다. 큐 서버 없이 매번 DB와 비교해서 할 일을 다시 구하니까 못 끝낸 포스터는 다음 실행이 이어받는다. 같은 포스터는 같은 경로에 덮어써서 두 번 돌아도 결과가 같다.'
tags = ["설계", "성능 최적화"]
+++

<!-- 저자 확인 필요:
- 썸네일 효과 수치 없음. poster_thumbnails의 bytes, source_bytes 합계를 넣을지 (없으면 "성능 최적화" 태그 빼기)
- 최적화를 끈 이유(df34068), 동시 요청 4개 제한(9c0531e), 워커 4개, 7일 보관의 이유는 근거 없어 안 씀
- 운영에서 remaining이 남은 적이 있는지, --budget 실행 결과 (30개 예시는 가상 예시)
- 배운점 문장
- 배운점에서 본문을 되풀이한 둘째 문장(실행이 끊기거나 ~ 덮어쓸 뿐이다)을 지웠다
-->

Vercel 크론은 정해진 시각에 Vercel이 내 API 라우트를 불러주는 기능인데, 실패해도 다시 불러주지 않는다. [공식 문서](https://vercel.com/docs/cron-jobs/manage-cron-jobs#cron-job-delivery-and-idempotency)에는 예정된 실행이 네트워크 문제로 아예 오지 않을 때도 있고, 같은 실행이 두 번 올 때도 있다고 나와 있다. 그러니까 크론으로 돌리는 일은 한 번 건너뛰어도 빠지는 게 없어야 하고 두 번 돌아도 결과가 같아야 한다.

내 개인 프로젝트인 [회전문](https://hoejeonmun.vercel.app/)은 공연 캐스팅보드(회차마다 나오는 배우를 적은 표)를 모아 보여주는 서비스인데, 여기서 포스터 썸네일을 만드는 크론이 이런 경우였다. 이 크론은 한 번 실행이 60초 안에 끝나야 해서 포스터가 많으면 그 안에 다 못 만들 수도 있다. 근데 큐 서버가 없으니 못 만든 포스터를 넣어둘 곳도 따로 없는 거였다.

## 목록 포스터를 썸네일로 바꾸면서 생긴 일

회전문의 공연 목록 화면은 카드마다 포스터를 96px 폭으로 보여준다. 근데 이미지를 표시 크기에 맞게 줄여서 보내주는 Next.js 이미지 최적화를 꺼둔 상태(`images.unoptimized: true`)라서 KOPIS(공연예술통합전산망)의 원본 포스터 파일이 [그대로](https://nextjs.org/docs/app/api-reference/components/image#unoptimized) 내려가고 있었다. 그래서 표시 폭의 3배인 288px짜리 WebP 썸네일을 미리 만들어두고 목록 화면에서는 그걸 쓰게 [바꿨다](https://github.com/detourguru/hoejeonmun/commit/f2587c8).

썸네일을 미리 만들어두려면 새로 생긴 공연이나 포스터가 바뀐 공연을 알아야 한다. 근데 KOPIS 공연 정보는 회전문이 조회해서 받아오기만 하니까 무엇이 새로 생기거나 바뀌었는지는 전체를 다시 봐야 알 수 있다. 그래서 썸네일은 매일 한 번 도는 크론이 전체 공연을 훑으면서 만든다.

이 크론 라우트에는 `maxDuration = 60`을 걸어서 함수가 60초까지만 돌게 했고, 작업 마감은 시작 후 50초로 잡았다. 그 50초 중 전체 공연을 가져오는 데 최대 20초, 예전 썸네일 파일을 지우는 데 최대 5초를 쓰고 남은 시간에 썸네일을 만든다.

## 첫 번째: 다시 돌려도 이미 만든 썸네일은 건너뛴다

큐가 있다면 포스터가 바뀔 때마다 할 일을 넣어두고 워커(할 일을 꺼내 처리하는 함수)가 하나씩 가져가면 된다. 근데 이 크론은 할 일을 어디에도 저장하지 않는다. 대신 실행할 때마다 지금 공연들의 포스터 주소를 `poster_thumbnails` 테이블에 저장된 썸네일 기록과 비교해서 할 일을 새로 구한다.

```ts
const { ordered: pending, failureOf } = orderPending(
  [...unique.entries()]
    .filter(
      ([showId, poster]) =>
        existing.get(showId)?.source_url !== normalizePosterUrl(poster), // 지금 포스터로 만든 썸네일이 없으면 할 일
    )
    .map(([showId, poster]) => ({ showId, poster })),
  failures, // 순서는 세 번째 단계에서 정한다
);
```

`poster_thumbnails`에는 공연마다 썸네일 기록이 하나씩 있고, 썸네일을 만들 때 쓴 포스터 주소가 `source_url`에 저장된다. 지금 포스터 주소가 `source_url`과 같으면 이미 만든 것이고, 다르거나 기록이 없으면 할 일이다. 그리고 비교하기 전에 `normalizePosterUrl`로 주소 표기를 하나로 맞춘다. `http://www.kopis.or.kr/upload/poster/PF1.gif`와 `https://kopis.or.kr/upload/poster/PF1.gif`는 둘 다 `kopis.or.kr/upload/poster/PF1.gif`가 되니까 표기만 다른 같은 포스터로 썸네일을 다시 만들 일은 없다.

썸네일 기록은 썸네일 파일을 업로드한 다음에야 저장한다. 그래서 실행이 중간에 끊겨도 할 일을 잃어버리지 않는다. 끊긴 포스터는 썸네일 기록이 없으니 다음 실행에서 다시 할 일로 잡힌다. 크론 실행이 하루 아예 오지 않아도 마찬가지라서 빠진 포스터를 찾아 따로 돌릴 필요가 없다. 썸네일이 만들어지기 전까지 목록 화면은 `source_url`이 지금 포스터 주소와 같은 썸네일만 쓰고, 그런 썸네일이 없으면 원본 포스터를 보여준다.

대신 바뀐 게 없는 날에도 비교를 위해 전체 공연의 썸네일 기록을 200개씩 나눠서 다 조회하게 된다.

썸네일 경로에는 포스터 주소로 만든 해시의 앞 16글자를 넣었다.

```ts
const sourceUrl = normalizePosterUrl(poster);
const hash = createHash("sha1")
  .update(sourceUrl)
  .digest("hex")
  .slice(0, 16);
// 포스터가 바뀌면 경로도 바뀌므로 1년 캐시를 걸어도 안전하다
const path = `${showId}/${hash}.webp`;
...
await mustSucceed(
  storage.upload(path, thumbnail, {
    ...
    upsert: true, // 같은 경로에 파일이 있으면 덮어쓴다
  }),
  "썸네일 업로드",
);
... // 파일이 올라간 다음에 show_id, source_url, path를 썸네일 기록으로 덮어쓴다
```

같은 포스터면 언제 만들어도 같은 경로가 나온다. 앞에서 표기만 달랐던 PF1 포스터 주소 두 개도 경로는 둘 다 `a2f89ab3f8e8a87b.webp`로 끝난다. 그래서 두 번 처리해도 같은 경로의 파일과 같은 `show_id`의 썸네일 기록을 덮어쓸 뿐이다. Vercel 문서는 크론이 겹쳐 도는 걸 막으려면 락(한 번에 하나만 돌게 막는 장치)을 쓰라고 하는데, 이 크론에는 락이 없다. 두 번 돌아도 썸네일을 만드는 시간만 한 번 더 들 뿐 결과가 틀리지는 않는 거였다.

포스터가 바뀌면 예전 포스터로 만든 썸네일 파일은 바로 지우지 않는다. 삭제 대기 테이블인 `poster_thumbnail_stale_files`에 넣어두고 7일 뒤에 크론이 지운다. 그 사이 포스터가 A에서 B로 바뀌었다가 다시 A로 돌아오면 A의 경로를 다시 쓰니까 삭제 대기에서 뺀다. 삭제 대기에서 빼는 처리가 실패해도 크론은 지우기 직전에 썸네일 기록을 다시 보고 지금 쓰는 경로는 지우지 않는다.

## 두 번째: 60초 안에 못 꺼낸 포스터는 다음 실행으로 넘긴다

할 일이 정해지면 워커 4개가 할 일 목록(`pending`)에서 포스터를 하나씩 꺼내서 썸네일을 만든다.

```ts
let cursor = 0;

const worker = async () => {
  while (cursor < pending.length) {
    const fetchTimeoutMs = Math.min(
      FETCH_TIMEOUT_MS,
      deadline - Date.now() - PROCESS_RESERVE_MS, // 다운로드 뒤에 변환하고 올릴 8초는 빼둔다
    );

    if (fetchTimeoutMs < MIN_FETCH_MS) break; // 다운로드에 5초도 못 주면 더 꺼내지 않는다

    const item = pending[cursor++];
    ...
    try {
      await processItem(item, fetchTimeoutMs);
    } catch (error) {
      await recordFailure(item, error); // 실패 기록만 저장하고 다음 포스터로
    }
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));

result.remaining = pending.length - cursor; // 꺼내지도 못한 개수
```

`cursor`는 워커 4개가 같이 쓰는 변수다. 자바스크립트는 `await`를 만나기 전까지 다른 워커로 넘어가지 않는데, `cursor < pending.length`를 확인하고 `pending[cursor++]`로 꺼내는 사이에는 `await`가 없다. 그래서 같은 실행 안에서 두 워커가 같은 포스터를 꺼내는 일은 없다.

워커는 포스터를 꺼내기 전에 마감까지 남은 시간부터 본다. 다운로드 뒤에 변환하고 업로드할 8초와 다운로드에 줄 최소 5초가 있어야 하니까 마감까지 13초가 안 남으면 새 포스터를 꺼내지 않는다.

예를 들어 할 일이 30개이고 포스터 하나에 9초씩 걸린다고 해보자. 전체 공연을 가져오고 예전 파일을 지우는 데 10초가 걸렸다면 워커마다 10초부터 9초 간격으로 37초까지 4개씩 꺼낸다. 37초에는 마감까지 13초가 남아서 아직 꺼낼 수 있다. 그 다음 46초에는 4초밖에 남지 않아서 멈춘다. 이 실행은 16개를 꺼낸 뒤 `remaining`이 14인 채로 끝난다.

이 14개는 어디에도 따로 저장하지 않는다. 다음 실행이 할 일을 다시 구하면 썸네일 기록이 없으니까 그대로 할 일로 잡힌다. 꺼냈다가 마감에 끊긴 포스터도 썸네일 기록이 없기는 마찬가지다. 그러니까 못 끝낸 일을 다음 실행에 넘기려고 따로 챙길 게 없고, `remaining`도 응답에 담기는 숫자일 뿐이다.

## 세 번째: 실패한 포스터는 기록하고 뒤로 보낸다

포스터 주소가 404 같은 오류를 주거나 변환에 실패한 포스터는 다음 날 다시 돌려도 또 실패할 수 있다. 그런 포스터가 할 일 맨 앞에 있으면 실행마다 워커 시간을 먼저 쓰게 된다. 그러면 뒤에 있는 새 공연의 썸네일은 마감에 걸려 다음 실행으로 밀린다. 그래서 실패하면 `poster_thumbnail_failures` 테이블에 실패 기록을 저장하고, 다음 실행에서 순서를 정할 때 뒤로 보낸다. 실패 기록에는 시도 횟수(`attempts`)와 마지막 시도 시각(`last_attempt_at`), 에러 내용이 들어간다.

```ts
const failureOf = ({ showId, poster }: { showId: string; poster: string }) => {
  const failure = failures.get(showId);

  return failure?.source_url === normalizePosterUrl(poster)
    ? failure
    : undefined; // 실패한 뒤 포스터가 바뀌었으면 실패 기록을 보지 않는다
};

const fresh = pending.filter((item) => !failureOf(item));
const retry = pending
  .filter((item) => failureOf(item))
  .sort((a, b) =>
    failureOf(a)!.last_attempt_at.localeCompare(
      failureOf(b)!.last_attempt_at,
    ), // 마지막 시도가 오래된 것부터
  );

return { ordered: [...fresh, ...retry], failureOf }; // 처음 보는 포스터가 먼저
```

실패한 포스터끼리는 마지막 시도가 오래된 것부터 앞에 선다. 예를 들어 실패한 포스터 두 개 중 오늘은 시간이 모자라 하나만 다시 시도했는데 또 실패했다고 해보자. 이 포스터는 `last_attempt_at`이 오늘로 바뀌어서 다음 날에는 오늘 시도하지 못한 다른 하나 뒤에 선다. `attempts`는 저장만 하고 시도를 멈추는 데는 쓰지 않아서 계속 실패하는 포스터도 할 일에서 빠지지 않는다.

실패한 뒤 포스터가 바뀌었으면 처음 보는 포스터로 보고 앞에 세운다. 바뀐 포스터로도 실패하면 `attempts`는 1부터 다시 센다. 성공하면 실패 기록을 지운다. 이 순서 규칙은 [`orderPending` 테스트](https://github.com/detourguru/hoejeonmun/blob/develop/src/service/poster-thumbnail-generator.test.ts)로 남겨뒀다.

한 실행 안에서는 실패한 포스터를 다시 시도하지 않는다. 실패 기록은 다음 실행이 할 일을 새로 구할 때 순서만 정하고, 할 일인지 아닌지는 썸네일 기록만 보고 가린다. 그러니까 실패 기록이 지워져도 그 포스터는 썸네일 기록이 없어서 할 일에서 빠지지 않는다.

## 등록 직후에는 응답을 보낸 뒤 바로 만든다

사용자가 KOPIS에 없는 공연을 직접 등록하면 다음 날 크론이 돌 때까지 검색 결과 같은 목록 화면에 원본 포스터가 나간다. 그래서 등록 응답을 보낸 뒤 그 공연의 썸네일 하나만 바로 [만들게 했다](https://github.com/detourguru/hoejeonmun/commit/eb4536a). Next.js의 [`after`](https://nextjs.org/docs/app/api-reference/functions/after)는 응답을 보낸 다음에 실행할 일을 예약하는 함수라서 등록 응답이 썸네일을 기다리지 않는다. 등록한 공연의 포스터를 바꿔서 수정할 때도 같은 방식으로 바로 만든다.

등록 직후에 도는 `generateUserShowThumbnail`은 크론과 같은 `generatePosterThumbnails` 함수를 대상 하나와 마감 30초로 부른다. 그래서 여기서 썸네일을 만들었으면 다음 크론이 건너뛴다. 실패했으면 썸네일 기록이 없으니 다음 크론이 다시 할 일로 잡는다. 따로 챙길 기록이 없어서 등록 액션에는 `after` 한 줄과 import만 더하면 됐다.

## KOPIS 요청은 메모리에서 줄을 세운다

KOPIS로 보내는 조회 요청에도 줄을 세우는 코드가 있다. 이 요청은 원래 동시에 4개까지만 보냈는데 [#51 로딩 속도 저하 체감 제보](https://github.com/detourguru/hoejeonmun/issues/51) 이후 [8개로 늘렸다](https://github.com/detourguru/hoejeonmun/commit/9de6769). 요청은 `acquireSlot`으로 동시 요청 8칸 중 한 칸을 받아야 나간다. 지금 나가 있는 요청 수는 `inFlight`로 센다. 8칸이 다 차 있으면 칸을 받을 때 부를 함수(`grant`)를 대기 줄인 `pending` 배열에 넣고 기다린다.

```ts
const timer = setTimeout(
  () => {
    const index = pending.indexOf(grant);

    if (index >= 0) pending.splice(index, 1); // 기다리다 포기하면 줄에서 빠진다

    reject(new KopisBudgetError("KOPIS 동시 요청 대기 중 시간 초과"));
  },
  Math.max(0, deadline - Date.now()), // 조회 하나에 주어진 10초가 끝나는 시각까지
);

pending.push(grant);
...
function releaseSlot() {
  const next = pending.shift();

  if (next) next(); // 기다리던 요청에 칸을 바로 넘긴다
  else inFlight--;
}
```

앞 요청이 끝나면 `releaseSlot`은 `inFlight`를 줄이지 않고 기다리던 요청에 칸을 바로 넘긴다. 그래서 기다리다 포기한 요청은 `pending`에서 꼭 빠져야 한다. 상한이 2칸이고 요청 1과 2가 나가 있다고 해보자. 이때 요청 3이 칸을 기다리다 포기했다. 요청 3이 줄에 남아 있으면 요청 1이 끝날 때 칸이 이미 포기한 요청 3에게 넘어간다. 요청 3은 이 칸을 쓰지 않으니 요청 2까지 끝나도 `inFlight`는 0이 아니라 1로 남는다. 아무도 안 쓰는 칸 하나가 계속 찬 것으로 세어지니까 상한이 8칸이라면 그 프로세스에서는 KOPIS 요청이 7개까지만 동시에 나가게 된다.

이 `pending` 줄은 모듈 변수라 서버 프로세스 메모리에만 있다. 프로세스가 끝나면 여기서 기다리던 KOPIS 조회도 그 조회를 부른 요청과 같이 끝나니까 따로 넘겨줄 일이 없다. 썸네일은 이와 달리 할 일을 메모리에 쌓지 않고 DB에 저장된 썸네일 기록과 비교해서 구한다. 그래서 오늘 못 만든 썸네일을 다음 실행이 이어받을 수 있다.

## 배운점

큐 서버가 없으니 처리한 결과를 DB에 저장하고 실행할 때마다 지금 상태와 비교해서 할 일을 다시 구하게 됐다.

[#126 여러 테이블에 걸친 쓰기를 트랜잭션으로 묶기](https://github.com/detourguru/hoejeonmun/issues/126) 이슈에는 업로드된 원본 이미지 삭제가 실패하면 기록해뒀다가 크론이 다시 지우는 완료 조건이 있다. 여기에도 썸네일의 삭제 대기 방식을 그대로 쓸 수 있을 것 같다. 결국 큐가 없어도 할 일이 빠지지 않으려면 다음 실행이 비교할 수 있는 기록부터 저장해야 하는 것 같다.
