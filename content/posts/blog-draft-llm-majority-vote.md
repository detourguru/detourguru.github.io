+++
date = '2026-10-21T00:00:00+09:00'
draft = true
title = 'LLM이 매번 다른 자리에서 틀려서 같은 표를 세 번 읽혔다'
description = '캐스팅보드 이미지를 Gemini로 읽어 저장하는데, 정답표로 같은 이미지를 10번 채점해보니 오류가 0건부터 7건까지 매번 다른 자리에서 나왔다. 그래서 같은 요청을 세 번 보내 배역마다 2표 이상 나온 값만 확정하게 바꿔서 평균 2.0건이던 오류를 0.4건으로 줄였다.'
tags = ["AI", "설계", "디버깅"]
+++

<!-- 저자 확인 필요:
- 정답표와 측정을 직접 했는지. #38은 Claude 작성 핸드오버라 링크에서 보인다.
- 3.8-flash 롤백: #38은 "반나절", 커밋은 44분 차이. 본문엔 기간 안 씀.
- Hobby라 maxDuration 60을 못 올린다는 전제가 지금도 맞는지.
- 첫 요청을 24초(deadlineMs / 2)에서 끊는데 4장 단일 요청은 44초였다. 지금 소요 시간 확인.
- afac8c9 이후 다시 잰 정확도가 있으면 마지막 섹션 끝에.
-->

회전문은 캐스팅보드 이미지를 올리면 Gemini가 표를 읽어서 날짜별로 어떤 배우가 나오는지 보여주는 서비스다. 응답은 JSON 스키마를 지정해서 받고 코드에서 한 번 더 검사하기 때문에 형식이 틀린 응답은 바로 걸러진다. 문제는 형식은 맞는데 내용이 틀린 응답이었다.

캐스팅보드 파싱 오류가 잦다는 제보가 들어왔다. 배우가 옆 배역 칸에 들어가 있거나 표에 없는 배역이 생기는 식이었다.

## 같은 이미지를 10번 읽히면 0건부터 7건까지 틀린다

얼마나 틀리는지 세려면 정답이 있어야 했다. 그래서 실제로 올라온 디어 에반 핸슨 캐스팅보드 이미지 4장을 두고, 원본 표를 읽어서 회차마다 배역과 배우를 적은 정답표를 만들었다. 그리고 같은 이미지와 같은 프롬프트로 지금 쓰는 모델(`gemini-3.5-flash-lite`)을 10번 호출해서 정답표와 다른 칸을 셌다.

```text
오류 수: 6, 0, 2, 2, 0, 0, 2, 7, 0, 4  -> 평균 2.3건, 완전 일치 4/10
```

10번 중 4번은 정답표와 완전히 같았고 한 번은 7건이 틀렸다. 모델이 이 표의 특정 칸을 항상 잘못 읽는 게 아니라 요청할 때마다 다른 자리에서 틀리고 있었던 것이다.

틀린 칸은 세 종류였는데, 종류에 따라 사람이 검수 화면에서 잡을 수 있는지가 달랐다.

| 유형 | 예시 | 검수 화면에서 잡을 수 있나 |
| --- | --- | --- |
| 배우 열 밀림 | `신시아 머피` 칸에 래리 머피 배우 `김영훈`이 들어감 | 사실상 불가 |
| 유령 배역 | `해당없음`, `Unnamed` 같은 배역이 생김 | 빈 칸으로 보여서 헷갈림 |
| 배역명 오독 | `재러드`를 `재럴드`로 읽음 | 쉬움 |

배역명 오독은 검수 화면 위쪽의 배역 이름 칸에서 한 번 고치면 모든 회차에 반영된다. 근데 열 밀림으로 들어간 김영훈은 이 표의 래리 머피 열에 실제로 있는 배우라서 이름만 봐서는 이상한 데가 없고, 원본 이미지와 한 줄씩 대조해야만 보인다.

열 밀림은 10월 3일과 4일, 16일과 17일처럼 대체 배우가 한 행에만 들어간 줄에 몰려 있었다. 래리 머피 칸에만 대체 배우가 들어간 행이라면 그 배우가 옆의 신시아 머피 칸에도 들어가는 식이다.

## 프롬프트와 모델을 바꾸고 이미지도 나눠봤다

### 프롬프트에 열 순서 규칙 넣기

한 행의 칸을 왼쪽부터 순서대로 읽고 N번째 칸을 N번째 배역 열에 맞추라는 규칙(`Read a row's casting cells in strict left-to-right order ...`)을 프롬프트에 넣었다. 그런데 이 규칙을 넣고 10번 돌려봐도 열 밀림이 5번 다시 나왔다. 규칙은 모든 요청에 똑같이 들어가는데 틀리는 자리는 요청마다 달랐다.

### 상위 모델로 바꾸기

모델만 바꿔보니 `gemini-3.7-flash`는 오류가 0건이었다. 근데 61초가 걸렸다. 이 API 라우트는 `maxDuration = 60`이라 60초 안에 응답해야 하는데, Vercel Hobby 플랜이라 이 값을 올릴 수 없다. `gemini-3.8-flash`로 [교체](https://github.com/detourguru/hoejeonmun/commit/7109fcc)해서 배포도 해봤지만 무료 티어 일일 한도가 20건이라 429 에러로 업로드가 전부 막혔고, [원래 모델로 되돌렸다](https://github.com/detourguru/hoejeonmun/commit/e208f83).

### 이미지를 장당 나눠 보내기

이미지 4장을 장마다 따로 동시에 보내면 요청 하나가 짧아진다. 지금 모델로 해보니 44초가 16초로 줄어서 상위 모델도 60초 안에 들어올 여지가 생겼다. 근데 한 요청으로 보낼 때 1건이던 오류가 50건으로 늘었다. ([#37 이미지 분할 파싱](https://github.com/detourguru/hoejeonmun/issues/37))

이 업로드처럼 긴 표를 나눠 캡처하면 배역 이름이 적힌 헤더 행은 첫 장에만 들어간다. 그래서 헤더가 없는 두 번째 이미지에서는 모델이 `에반`, `하이디`처럼 헤더와 다른 배역 이름을 지어냈고, 세 번째 이미지에서는 `배역1`부터 `배역8`까지 번호를 붙였다. 뒤쪽 이미지는 한 요청 안에서 첫 장의 헤더를 같이 봐야 배역을 맞출 수 있었다.

## 같은 요청을 세 번 보내고 배역마다 다수결로 정하자

모델은 그대로 두고 이미지도 나누지 않아야 하니 남은 건 오류가 매번 다른 자리에서 난다는 점이었다. 틀리는 자리가 요청마다 다르다면 서로 독립된 요청 여러 번에서 같은 값이 나온 칸은 믿을 수 있고, 값이 갈린 칸만 의심하면 된다.

그래서 이미지 전체를 같은 프롬프트로 세 번 보내고 회차 안의 배역마다 다수결로 정하게 [작업했다](https://github.com/detourguru/hoejeonmun/commit/89bbefb). ([#38 다수결 도입](https://github.com/detourguru/hoejeonmun/issues/38))

```ts
const serializeCastingValue = (actors: string[]) =>
  [...actors].sort().join("\u0000"); // 앙상블처럼 배우가 여럿이면 순서가 달라도 같은 표로 센다

export function buildConsensusPerformances(
  runs: ParsedPerformance[][],
  threshold: number,
): ParsedPerformance[] {
  const bySlot = new Map<string, ParsedPerformance[]>(); // 세 결과를 slotKey(날짜, 시각)로 묶는다
  // ...
  for (const performances of bySlot.values()) {
    // ...
    const roleNames = new Set(
      performances.flatMap(({ casting }) => Object.keys(casting)),
    ); // 한 번이라도 나온 배역 이름은 모두 후보
    const casting: Record<string, string[]> = {};
    const unsureRoles: string[] = [];

    for (const role of roleNames) {
      const votes = performances
        .map((performance) => performance.casting[role])
        .filter((actors): actors is string[] => Array.isArray(actors));
      const best = pickMostCommonValue(votes, serializeCastingValue);

      if (best && best.count >= threshold) {
        casting[role] = [...best.value]; // threshold번 이상 같은 배우면 확정
      } else {
        unsureRoles.push(role); // 아니면 비워두고 확인이 필요한 배역으로 남긴다
      }
    }
    // ...
  }
  // ...
}
```

열 밀림이 세 요청 중 한 번에만 나오면 밀려 들어온 배우는 1표라 확정되지 못한다. 실제로 처음 세 번을 동시에 돌려봤을 때 신시아 머피 칸에 정동근이 들어간 열 밀림이 두 번째 요청에만 있었고 다수결에서 빠졌다. 남은 오류는 `재러드`를 `재럴드`로 읽은 배역명 오독뿐이었다. 사람이 잡기 어려운 오류는 다수결이 지우고 검수 화면에서 한 번에 고칠 수 있는 오류만 남은 것이다.

`Unnamed` 같은 유령 배역도 세 번 중 한 번만 나오면 1표라서 `casting`에 들어가지 않는다. 확정되지 못한 배역은 `unsureRoles`에 이름만 남고, 검수 화면은 이런 회차를 펼쳐서 원본과 대조해달라는 경고와 함께 보여준다. 이 다수결 규칙은 이후 [테스트](https://github.com/detourguru/hoejeonmun/commit/4c94d2f)로 남겼다.

## 2표로 확정할까 3표로 확정할까

세 번 중 두 번이 같으면 확정하는 2/3 기준과 세 번 모두 같아야 확정하는 3/3 기준을 놓고, 세 요청을 동시에 보내는 걸 5번 반복해서 정답표와 비교했다.

| 시행 | 걸린 시간 | 요청별 오류 | 2/3 기준 | 3/3 기준 |
| --- | --- | --- | --- | --- |
| 1 | 51초 | 0, 3, 2 | 0건 | 1건 |
| 2 | 42초 | 0, 0, 2 | 0건 | 1건 |
| 3 | 43초 | 2, 4, 5 | 2건 | 0건 |
| 4 | 39초 | 0, 5, 0 | 0건 | 0건 |
| 5 | 54초 | 0, 5, 2 | 0건 | 1건 |
| 평균 | | 2.0건 | 0.4건 | 0.6건 |

평균으로 보면 더 엄격한 3/3 기준이 오히려 더 많이 틀렸다. 3/3 기준에서 틀린 건 전부 `재러드` 배역이 회차에서 통째로 빠진 경우였다.

위 코드는 배역 이름을 키로 표를 센다. 세 번 중 한 번만 `재러드`를 `재럴드`로 읽어도 `재러드`는 2표, `재럴드`는 1표가 된다. 2/3 기준이면 `재러드`가 확정되고 `재럴드`만 확인이 필요한 배역으로 빠지지만, 3/3 기준이면 둘 다 3표를 못 채워서 `재러드`의 배우까지 비게 된다. 한 글자 오독을 막으려다 배역 하나를 통째로 잃는 것이다.

2/3 기준도 3번 시행에서는 2건이 틀렸다. 세 요청이 각각 2건과 4건, 5건씩 틀릴 만큼 결과가 나빴던 시행이다. 세 번 중 두 번이 같은 칸을 같은 값으로 틀리면 다수결도 그 값을 확정한다. 그래도 5번 중 4번은 정답표와 완전히 같았기 때문에 기준은 2로 정했다.

## 48초 마감까지 도착한 결과로만 투표하기

처음에는 세 요청을 한꺼번에 보냈다. 세 요청이 동시에 돌기 때문에 걸리는 시간은 그중 가장 느린 요청 하나로 정해지고, 처음 측정했을 때는 38초로 한 번만 보내던 44초보다 오히려 짧았다. 그런데 위 표처럼 5번 반복하니 39초에서 54초 사이를 오갔다.

이 라우트는 이미지를 내려받고 중복 이미지와 겹치는 이벤트를 조회하는 일까지 60초 안에 끝내야 해서, 54초가 걸리는 날이면 60초를 넘는다. 그래서 마감을 48초로 두고 그때까지 도착한 결과로만 다수결로 정하게 했다. 세 개가 도착하면 2/3 기준으로 합치고, 두 개만 도착하면 둘이 같은 값을 낸 배역만 확정한다. 하나만 도착하면 다수결 없이 그 결과를 그대로 쓴다.

세 번씩 보내면 Gemini 무료 티어의 요청 한도도 세 배로 쓰게 된다. 그래서 이후 분당 요청 한도에 맞추려고 첫 요청 결과의 확신도가 충분하면 한 번으로 끝내도록 [바꿨고](https://github.com/detourguru/hoejeonmun/commit/afac8c9), 지금은 첫 요청을 먼저 보내고 필요할 때만 나머지 두 요청을 동시에 보낸다.

```ts
const firstResult = await runAttempt(0) // 요청마다 AbortController로 마감까지만 기다린다
  .then((value) => ({ ok: true as const, value }))
  .catch((error) => ({ ok: false as const, error }));

if (
  firstResult.ok &&
  !needsConsensus(firstResult.value.performances, confidenceThreshold)
) {
  // ...
  return firstResult.value; // 확신도가 충분하면 한 번으로 끝낸다
}

const rest = await Promise.allSettled(
  Array.from({ length: runs - 1 }, (_, index) => runAttempt(index + 1)),
); // 나머지 두 요청은 동시에 보낸다

// ... 첫 요청과 나머지 두 요청 중 성공한 결과만 successful에 모은다
const base = successful[0].value; // 하나만 도착했으면 바로 아래에서 base를 그대로 돌려준다
// ...
const effectiveThreshold = Math.min(threshold, successful.length); // 2개든 3개든 2
const performances = buildConsensusPerformances(
  successful.map(({ value }) => value.performances),
  effectiveThreshold,
);
// ...
return {
  ...base, // 이벤트처럼 합치면 중복되는 결과는 첫 번째 것을 쓴다
  performances, // 회차만 다수결 결과로 바꾼다
};
```

[`Promise.allSettled`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)는 `Promise.all`과 달리 하나가 실패해도 나머지가 끝날 때까지 기다렸다가 결과를 모두 돌려주기 때문에 한 요청이 마감에 걸려 끊겨도 도착한 결과로 다수결을 낼 수 있다.

## 확신도가 높으면 한 번으로 끝낸다

첫 요청에서 다수결을 건너뛸지는 `needsConsensus`가 회차별 `confidence`를 보고 정한다. `confidence`와 `unsureRoles`는 둘 다 이 회차를 믿어도 되는지 알려주는 값처럼 보이지만 보는 대상이 다르다. `confidence`는 모델이 응답 하나 안에서 스스로 매긴 점수이고, `unsureRoles`는 서로 독립된 응답을 비교해서 실제로 값이 갈린 배역이다.

그래서 첫 요청이 모든 회차에 0.7보다 높은 확신도를 매기면 그 결과는 다수결을 거치지 않고, 다른 경고가 없으면 검수 화면에서도 `N건 자동확정` 쪽으로 접혀서 보인다. 모델이 확신하면서 틀린 결과라면 그대로 통과한다. [#31 회차별 확신도 검수](https://github.com/detourguru/hoejeonmun/issues/31)에서 확신도를 처음 넣을 때 유의사항으로 적어둔 것도 이 경우였다. 확신도가 낮은 업로드는 첫 요청이 끝난 뒤에 두 요청을 더 보내니 세 요청을 한꺼번에 보내던 때보다 오래 걸리기도 한다. 분당 요청 수를 줄이는 대신 이 두 가지를 받아들인 구조다.

요청 수와 갈린 배역 수는 파싱마다 `casting_parse_consensus_logs` 테이블에 [남긴다](https://github.com/detourguru/hoejeonmun/commit/2ebd93e).

## 배운점

형식은 맞는데 내용이 틀리는 LLM 응답은 한 번만 봐서는 어디가 틀렸는지도, 얼마나 자주 틀리는지도 알 수 없었다. 정답표를 만들어 같은 이미지를 10번 채점하고 나서야 오류가 요청마다 다른 자리에서 난다는 게 드러났고, 그 덕분에 모델을 바꾸지 않고도 다수결로 열 밀림을 걸러낼 수 있었다.

결국 LLM이 읽어온 결과를 어디까지 믿을지는 정답표를 만들어 직접 세어봐야 정할 수 있는 것 같다.
