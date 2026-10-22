+++
date = '2026-10-14T00:00:00+09:00'
draft = false
title = '자꾸만 틀리는 LLM을 믿을만하게 만들기'
description = '캐스팅보드 이미지를 Gemini로 읽어 저장하는데, 정답표를 두고 같은 이미지를 10번 채점해보니 오류 수가 0건부터 7건까지 들쭉날쭉했다. 그래서 동일한 요청을 세 번 보내 다수결로 배역마다 2표 이상 나온 값만 확정하도록 바꿨고, 5번 시행해보니 요청 하나당 평균 2.0건이던 오류가 다수결 뒤에는 0.4건으로 줄었다. 지금은 LLM이 스스로 판단하기에 파싱 확신도가 낮은 경우(0.7 이하)에만 두 번 더 보낸다.'
tags = ["AI", "설계", "디버깅"]
+++

내 개인 프로젝트인 [회전문](https://hoejeonmun.vercel.app/)은 사용자가 캐스팅보드 이미지를 올리면 Gemini가 표를 읽어서 날짜와 회차별로 어떤 배우가 나오는지 보여주는 서비스다. 응답은 JSON 스키마를 지정해서 받고 코드에서 한 번 더 검사하기 때문에 형식이 틀린 응답은 바로 걸러진다. 문제는 형식은 강제할 수 있는데, 파싱 정확도는 강제할 수 없다는 거였다.

캐스팅보드 파싱 오류가 잦다는 제보가 들어왔다. 날짜 표를 잘못 읽어 배우가 옆 배역 칸에 들어가 있거나 글자를 잘못 읽어 표에 없는 배역이 생기는 식이었다.

## 같은 이미지를 같은 LLM이 읽는데도 결과는 항상 다르다?

어디에서 얼마나 틀리는지 확인을 위해 실제로 업로드된 뮤지컬 디어 에반 핸슨 캐스팅보드 이미지 4장을 가지고 회차마다 배역과 배우를 적은 정답표를 먼저 만들었다. 그리고 같은 이미지와 같은 프롬프트로 지금 쓰는 모델(`gemini-3.5-flash-lite`)을 10번 호출해서 정답표와 얼마나 다른지 표시하도록 했다.

```text
// 요청 10번의 오류 수
오류 수: 6, 0, 2, 2, 0, 0, 2, 7, 0, 4  -> 평균 2.3건, 완전 일치 4/10
```

10번 중 4번은 정답표와 완전히 같았고 한 번은 7건까지 틀렸다! 모델이 이 표의 특정 칸을 항상 잘못 읽는 게 아니라 요청할 때마다 다 다르게 읽는 것이 문제였다. 물론 이렇게 틀린 칸들은 사람이 직접 보고 수정하면 됐지만 종류에 따라 사람이 검수 화면에서 잡을 수 있는지가 다 달랐다.

| 유형 | 예시 | 검수 화면에서 잡을 수 있나 |
| --- | --- | --- |
| 배우 열 밀림 | `신시아 머피` 칸에 래리 머피 배우 `A`가 들어감 | 사실상 불가 |
| 유령 배역 | `해당없음`, `Unnamed` 같은 배역이 생김 | 빈 칸으로 보여서 헷갈림 |
| 배역명 오독 | `재러드`를 `재럴드`로 읽음 | 쉬움 |

배역명 오독은 검수 화면 위쪽의 배역 이름 칸에서 한 번 고치면 모든 회차에 반영되니 어렵지 않다. 근데 열 밀림으로 들어간 `A`는 이 표의 `래리 머피` 열에 실제로 있는 배우라서 언뜻 이름만 봐서는 이상한 데가 없고, 원본 이미지와 한 줄씩 대조해야만 보인다.

## 어떻게 해야 에러가 줄어들까?

### 프롬프트에 열 순서 규칙 넣기

먼저 `한 행의 칸을 항상 왼쪽부터 순서대로 읽고 N번째 칸은 N번째 배역 열에 맞추라`는 규칙을 프롬프트에 넣었다. 근데 이 규칙을 넣고 10번 돌려보니 열 밀림이 5번이나 다시 나왔다. 규칙은 모든 요청에 똑같이 들어가는데 틀리는 칸은 요청마다 달랐다.

### 상위 모델로 바꾸기

그 다음엔 상위 모델로 바꿔보기로 했다. 가장 저렴한 기존의 `gemini-3.5-flash-lite`에서 `gemini-3.7-flash`로 바꿔보니 오류는 0건이었는데 응답에 61초가 걸렸다. 같은 이미지를 기존 모델은 44초에 읽었으니 17초가 더 걸린 셈이다. 더 상위 모델인 `gemini-3.8-flash`로 [교체](https://github.com/detourguru/hoejeonmun/commit/7109fcc)해서 배포도 해봤지만 무료 티어 일일 한도가 20건이라 429 에러로 업로드가 전부 막혀서 [원래 모델로 되돌릴 수밖에 없었다](https://github.com/detourguru/hoejeonmun/commit/e208f83).

### 이미지를 한 장씩 따로 요청하기

이미지 4장을 한 요청에 다 넣지 않고 한 장씩 네 요청으로 나눠 동시에 보내봤다. 요청마다 이미지가 한 장뿐이라 기존 모델 기준으로 44초 걸리던 게 16초로 줄었고, 상위 모델도 60초 안에 들어올 여지가 생겼다. 근데 그때 같은 이미지로 비교해보니 한 요청으로 보냈을 때는 오류가 1건이었는데 나눠 보내니 50건으로 늘었다([#37 이미지 분할 파싱](https://github.com/detourguru/hoejeonmun/issues/37)).

## 같은 요청을 여러 번 보내고 배역마다 다수결로 정하자

모델은 그대로 두고 이미지도 나누지 않아야 하니 남은 건 오류가 요청마다 다른 칸에서 난다는 점이었다. 틀리는 칸이 요청마다 다르다면 따로 보낸 요청 여러 번에서 같은 값이 나온 칸은 믿을 수 있고, 값이 갈린 칸만 의심하면 된다.

그래서 [#38 다수결 도입](https://github.com/detourguru/hoejeonmun/issues/38)에서 이미지 전체를 같은 프롬프트로 세 번 보내고 회차 안의 배역마다 다수결로 정하게 [작업했다](https://github.com/detourguru/hoejeonmun/commit/89bbefb). 세 결과를 날짜와 시각이 같은 회차끼리 묶은 뒤, 배역마다 같은 배우가 기준 횟수 이상 나왔을 때만 확정한다.

```ts
const serializeCastingValue = (actors: string[]) =>
  [...actors].sort().join("\u0000"); // ["가", "나"]와 ["나", "가"]를 같은 값으로 센다

export function buildConsensusPerformances(
  runs: ParsedPerformance[][],
  threshold: number,
): ParsedPerformance[] {
  const bySlot = new Map<string, ParsedPerformance[]>(); // 세 결과를 slotKey(날짜, 시각)로 묶는다
  for (const performances of bySlot.values()) {
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
  }
}
```

열 밀림이 세 요청 중 한 번에만 나오면 밀려 들어온 배우는 1표기 때문에 확정되지 못한다. 실제로 처음 세 요청을 동시에 돌려봤을 때 신시아 머피 칸에 래리 머피 배우 `B`가 들어간 열 밀림은 두 번째 요청에만 있어서 다수결에서 빠졌다. 남은 오류는 `재러드`를 `재럴드`로 읽은 배역명 오독뿐이었다. 사람이 잡기 어려운 오류는 다수결이 지우고 검수 화면에서 한 번에 고칠 수 있는 오류만 남은 것이다!

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

{{< demo name="majority-vote" height="auto" >}}

2/3 기준도 3번째 시행에서는 2건이 틀렸다. 세 요청이 각각 2건과 4건, 5건씩 틀릴 만큼 결과가 나빴던 시행이다. 세 번 중 두 번이 같은 칸을 같은 값으로 틀리면 다수결도 그 값을 확정한다. 그래도 5번 중 4번은 정답표와 완전히 같았기 때문에 2/3 기준으로 정했다.

## 48초 마감까지 도착한 결과로만 다수결 내기

처음에는 세 요청을 한꺼번에 보냈다. 세 요청이 동시에 돌기 때문에 걸리는 시간은 그중 가장 느린 요청 하나로 정해지는데, 처음 측정했을 때는 38초로 한 번만 보내던 44초보다 오히려 짧았다. 그런데 위 표처럼 5번 반복하니 39초에서 54초 사이를 오갔다.

이 라우트는 이미지를 내려받고 중복 이미지와 겹치는 이벤트를 조회하는 일까지 60초 안에 끝내야 해서 Gemini 응답에 54초가 걸리면 60초를 넘길 수 있다. 그래서 마감을 48초로 두고 그때까지 도착한 결과로만 다수결을 내게 작업했다. 세 개가 도착하면 2/3 기준으로 합치고, 두 개만 도착하면 둘이 같은 값을 낸 배역만 확정한다. 하나만 도착하면 다수결 없이 그 결과를 그대로 쓴다.

근데 매번 세 번씩 보내면 Gemini 무료 티어의 요청 한도도 세 배로 쓰게 된다. 그래서 이후 분당 요청 한도에 맞추려고 첫 요청 결과의 확신도가 충분하면 한 번으로 끝내도록 [바꿨다](https://github.com/detourguru/hoejeonmun/commit/afac8c9). 지금은 첫 요청을 먼저 보내고 필요할 때만 나머지 두 요청을 동시에 보낸다.

```ts
const firstResult = await runAttempt(0)
  .then((value) => ({ ok: true as const, value }))
  .catch((error) => ({ ok: false as const, error }));

if (
  firstResult.ok &&
  !needsConsensus(firstResult.value.performances, confidenceThreshold)
) {
  return firstResult.value; // 확신도가 충분하면 한 번으로 끝낸다
}

const rest = await Promise.allSettled(
  Array.from({ length: runs - 1 }, (_, index) => runAttempt(index + 1)),
); // 나머지 두 요청은 동시에 보낸다

// 첫 요청과 나머지 두 요청 중 성공한 결과만 successful에 모은다
const base = successful[0].value;

if (successful.length === 1) {
  return base; // 하나만 도착하면 다수결 없이 그대로 쓴다
}

const effectiveThreshold = Math.min(threshold, successful.length); // 2개든 3개든 2가 된다
const performances = buildConsensusPerformances(
  successful.map(({ value }) => value.performances),
  effectiveThreshold,
);
return {
  ...base, // 이벤트처럼 합치면 중복되는 결과는 첫 번째 것을 쓴다
  performances, // 회차만 다수결 결과로 바꾼다
};
```

나머지 두 요청은 [`Promise.allSettled`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)로 기다린다. 

> `Promise.all`은 요청 하나만 실패해도 바로 실패로 끝나지만 `Promise.allSettled`는 모든 요청이 끝날 때까지 기다렸다가 성공과 실패를 함께 돌려준다. 그래서 한 요청이 마감에 걸려 끊겨도 도착한 결과로 다수결을 낼 수 있다.

## 확신도가 높으면 한 번으로 끝낸다

첫 요청에서 다수결을 건너뛸지는 `needsConsensus`가 회차별 `confidence`를 보고 정한다. `confidence`와 `unsureRoles`는 둘 다 이 회차를 믿어도 되는지 알려주는 값처럼 보이지만 살짝 다르다. `confidence`는 모델이 응답 하나 안에서 스스로 매긴 점수이고, `unsureRoles`는 따로 보낸 응답끼리 비교해서 실제로 값이 갈린 배역이다.

첫 요청이 모든 회차에 0.7보다 높은 확신도를 매기면 그 결과는 다수결을 거치지 않고, 다른 경고가 없으면 검수 화면에서도 `N건 자동확정` 쪽으로 접혀서 보인다. 그래서 모델이 확신하면서 틀렸다면 그 결과는 그대로 통과한다. [#31 회차별 확신도 검수](https://github.com/detourguru/hoejeonmun/issues/31)에서 확신도를 처음 넣을 때 유의사항으로 적어둔 것도 이 경우였다. 그리고 확신도가 낮은 업로드는 첫 요청이 끝난 뒤에 두 요청을 더 보내기 때문에 세 요청을 한꺼번에 보내던 때보다 오래 걸릴 수 있다. 분당 요청 수를 줄이는 대신 이 두 가지를 받아들인 구조다.

요청 수와 갈린 배역 수는 파싱마다 `casting_parse_consensus_logs` 테이블에 [남긴다](https://github.com/detourguru/hoejeonmun/commit/2ebd93e). 9월 30일부터 10월 22일까지 쌓인 파싱 86건을 보면 35건은 첫 요청 하나로 끝났고, 나머지 51건은 두 요청을 더 보내 다수결을 판단했다.

## 배운점

사실 다수결 방식이 통한 건 틀리는 칸이 요청마다 달랐기 때문이다. 모델이 같은 칸을 매번 같은 값으로 틀렸다면 세 번을 보내도 틀린 값이 2표를 얻어 그대로 확정됐을 것이다. (이 경우 사람이 보고 직접 고쳤겠지만)

그리고 한도가 비교적 넉넉한 Gemini 무료 티어에서 가장 저렴한 모델을 쓰고 있어서 같은 요청을 세 번까지 보낼 수 있었기 때문에 이 방식으로 정했다. 만약 쓰는 LLM의 토큰이 비쌌다면, 그리고 이게 실제 서비스였다면 아마 같은 요청을 다시 보내는 대신 판단만 내려주는 모델을 보조로 쓰는 방법을 골랐을 것 같다. 실제로 회전문에서도 [이벤트 중복 판정](https://github.com/detourguru/hoejeonmun/commit/8f8d619)에는 [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)라는 모델을 쓰고 있는데, 파싱에 쓰는 LLM보다 훨씬 저렴하면서 빠르게 판단만 내려준다.

AI에 대한 의존도가 점점 높아져가는 세상에서 응답을 온전히 믿을 수 없다는 것은 아이러니한 일이다. 여러 방식으로 AI 활용 서비스에서 응답의 신뢰도를 높이려고 하겠지만 아무튼 내가 선택한 건 이런 방식이었다. 그 결과 같은 5번의 시행에서 요청 하나당 평균 2.0건이던 오류를 0.4건까지 줄이는 쾌거를 거둘 수 있었다!