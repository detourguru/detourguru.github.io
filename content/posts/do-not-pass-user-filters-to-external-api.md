+++
date = '2026-08-11T21:10:00+09:00'
draft = false
title = '사용자 필터를 외부 API로 넘기지 않기로 했다'
description = '사용자 필터를 외부 API에 그대로 넘기면 URL이 캐시 키라 캐시가 무의미해진다. 응답 안에서 거르도록 바꾼 과정.'
tags = ["캐싱", "설계", "성능 최적화"]
+++

외부 API로 목록 화면을 만들다 보면 필터가 하나씩 늘어날 때마다 캐시가 조용히 무의미해지는 순간이 온다. 사용자가 필터를 걸면 그 필터를 그대로 요청에 실어 보내는 게 보통인데, 이게 캐싱이랑 같이 가면 생각보다 잘 안 맞는다.

호출 제한이 붙어있는 외부 API라면 개발자는 이를 방지하기 위해서 캐싱을 붙이게 된다. 하지만 필터가 너무 다양하다면? 장르, 지역, 상태, 정렬, 검색어, 날짜... 경우의 수가 너무 다양하고 특히 검색어는 뭐 예측할 수 있는 범주도 아니다.

그럼 예측 가능한 필터만 요청 URL에 실어 보내고 사용자가 고른 필터들은 이미 받아온 그러니까 캐싱된 데이터 내에서 거르게 하면 되지 않을까?

## 필터는 쿼리 URL의 쿼리파라미터로 넘기면 되지

KOPIS의 공연목록 API는 이런 파라미터를 받는다.

```
/pblprfr?service={key}&stdate=20260812&eddate=20261112
        &shcate=GGGA      // 장르
        &signgucode=11    // 지역
        &prfstate=02      // 공연 상태
        &shprfnm=레미제라블 // 공연명 검색
```

나는 어렵지 않게 `searchParams`를 받아서 그대로 `URLSearchParams`에 넣고 던져주었다.

[feat: /show 목록 필터, 정렬 추가](https://github.com/detourguru/hoejeonmun/commit/c5ee06f51d589a0ec51f567838e2441ba3a52829#diff-8a29bbad076464a7f2ed173083f6eab39d1a245fde64fc4cacfd644a8a8016fa)

```tsx
// 처음 코드
const queryParams = new URLSearchParams(params as Record<string, string>);
const data: Show[] = await getKopis("/pblprfr", queryParams);
```

그리고 getKopis 안에선 route.replace 해서 사용자가 드롭다운을 선택할 때마다 쿼리파라미터에 반영되었다. 필터 기능 추가 끝!

## 캐시 키 == URL

그런데 생각을 해보니 한번 호출한 응답은 캐싱을 하는게 낫겠다고 판단이 됐다. 왜냐면 공연정보는 잘 변경되지 않으니까 캐싱을 해두면 여러번 재활용할 수 있을 것 같았다.

하지만 찾아보니 Next.js의 App Router에서 캐시 항목을 구분하는 키는 요청 URL과 fetch 옵션이었다. 그러니까 URL에서 한글자라도 다르면 그건 별개의 캐시 항목이다. 그러니 필터를 URL에 포함해서 요청하는 지금 구조는 필터 조합마다 캐시가 따로 된다는 뜻이었다.

사실 이건 배포하고 나서 캐시 미스가 눈에 띄어서 알아챈 게 아니다. 캐싱을 붙이려고 문서를 읽다가 "어? 그럼 내가 짠 건 캐시가 아예 안 먹겠는데?" 하고 뒤늦게 계산해본 쪽에 가깝다.

내가 붙이려던 필터로 조합을 세보면 이렇다.

| 필터   | 가짓수                   |
| ------ | ------------------------ |
| 장르   | 3 (전체/연극/뮤지컬)     |
| 지역   | 15 (전체 + 14개 시도)    |
| 상태   | 3 (전체/진행중/개막예정) |
| 검색어 | 사실상 무한              |

검색어를 빼도 3 × 15 × 3 = 135가지다. 게다가 KOPIS는 한 번에 100건만 주기 때문에 조합 하나가 여러 페이지로 나뉜다. 캐시 항목은 페이지 단위로 쌓이니 실제 개수는 여기에 페이지 수를 또 곱해야 한다.

검색어까지 생각해보면 이건 거의 말이 안됐다. 한 글자 칠때마다 URL이 달라질수밖에 없는 구조다. debounce를 추가해준다해도 사용자가 뭘 검색할지는 알 수 없다. 캐시를 붙여도 히트율이 의미가 없는 상황이 된다.

### 고려해본 다른 방법들...

물론 필터를 그대로 넘기면서 캐시를 살릴 방법을 아예 안 찾아본 건 아니었다.

`revalidateTag`로 태그를 걸어두고 부분 무효화하는 방법을 고려해봤는데 무효화 시점을 내가 정할 수 있다는 건 확실히 장점이지만 문제는 내가 그 시점을 모른다는 거였다. KOPIS가 공연 정보를 언제 갱신하는지 알려주는 웹훅 같은 게 없으니 결국 적당히 주기적으로 끊어줘야하는데 그러면 시간 기반 revalidate랑 별로 다를 게 없어진다. 게다가 캐시 키가 URL이라는 문제 자체는 태그를 붙여도 그대로 남는다.

redis 같은 캐시 레이어를 두라는 아티클을 보긴했는데 mvp 수준의 작은 앱에서 거기까지 가면 너무 오버엔지니어링 같았다.

## 그럼 캐싱된 값 내에서 필터를 걸자

값을 한번 조회할때 예측 가능한 필터로 큰 범위를 조회해두고 사용자 필터링은 나중에 달아주면 되지 않을까? 어차피 공연 수는 무한하지 않은데다가 장르도 2가지로 많이 좁혀놨고, 보통 한 공연이 몇 달은 걸려있는 것을 고려하면 나쁘지 않은 생각인 것 같았다.

그래서 KOPIS에 넘기는 건 딱 필수값정도로 수정했다.

```ts
export async function getShows(): Promise<Show[]> {
  const { stdate, eddate } = getPeriod(); // 오늘 ~ 3개월

  const pages = await Promise.all(
    // 장르 코드별로 나눠 호출한 뒤 합친다
    GENRE.codes.map((shcate) =>
      fetchKopisAll<Show>(
        "/pblprfr",
        new URLSearchParams({ stdate, eddate, shcate }),
        { rows: 100, maxPages: 10, revalidate: 60 * 60, tags: ["shows"] },
      ),
    ),
  );

  return pages.flat().filter((show) => show?.mt20id);
}
```

`getShows`는 보다시피 인자가 아예 없어 사용자 입력을 받지 않는다. 그래서 결국 모든 목록 호출에 캐시는 항상 같은 URL 2개로 고정된다. 나머지 필터는 전부 받아온 배열 위에서 처리한다.

```ts
export function filterShows(shows: Show[], filters: ShowFilters): Show[] {
  const keyword = filters.shprfnm && normalizeText(filters.shprfnm);
  const state = filters.prfstate && STATE.nameByCode[filters.prfstate];
  const genre = filters.shcate && GENRE.nameByCode[filters.shcate];
  const areaNames =
    filters.signgucode && AREA_NAMES_BY_CODE[filters.signgucode];

  return shows.filter((show) => {
    if (genre && show.genrenm !== genre) return false;
    if (state && show.prfstate !== state) return false;
    if (areaNames && !areaNames.includes(show.area)) return false;
    if (keyword && !normalizeText(show.prfnm).includes(keyword)) return false;
    if (normalizeDate(show.prfpdfrom) > filters.to) return false;
    if (normalizeDate(show.prfpdto) < filters.from) return false;
    return true;
  });
}
```

사용자 입력이 요청에 포함되지 않으니 사용자가 잘못 입력한 값이 있어도 파라미터 화이트리스트를 추가하거나 별도의 처리가 필요없다는 부수효과도 생겼다.

## 장르 OR 조회가 안되는 것도 같이 해결했다

KOPIS는 장르 `shcate`에 코드 하나만 받는다. `?shcate=뮤지컬&shcate=연극` 이런식이나 or 필터를 제공하지 않는다. 그래서 기본 필터를 장르 하나로 설정하기도 애매하고 해서 골치아팠는데 어차피 전량을 받아 캐싱하기로 했으니 문제가 자연스럽게 해소되었다. 사용자가 장르를 고르든 말든 KOPIS 호출은 똑같고 장르 선택은 메모리에서 장르 이름 `genrenm` 비교 한번이면 필터를 걸어줄 수 있게 되었다.

### 캐시와 메모리의 차이

캐시, 메모리. 개발자로서 막 낯선 단어들은 아닌데 나도 모르게 좀 뭉뚱그려 사용하고 있었던 용어들같다.

|         | Data Cache                | 메모리(힙)                    |
| ------- | ------------------------- | ----------------------------- |
| 사는 곳 | 디스크 / 호스팅 캐시 계층 | 서버 Node 프로세스 힙         |
| 수명    | `revalidate` 동안         | 요청 끝나면 가비지 컬렉션으로 |
| 담긴 것 | XML 원문 텍스트           | 파싱된 `Show[]` 객체          |

중요한 건 데이터 캐시는 파싱된 객체가 아닌 fetch 응답 본문을 저장하고있다는 것이다. 그래서 한번 파싱한다고 계속 재사용하는 것은 아니고 캐시가 히트되더라도 XML 파싱은 요청마다 다시 한다.

그래서 지금 구조의 요청 흐름은 이렇게 된다.

```
1. Data Cache에서 XML 원문 꺼냄 // 네트워크 없음
2. XMLParser로 파싱 -> Show[] // 요청마다 새로
3. filterShows / sortShows / paginate // 여기가 메모리
4. 30건만 HTML로 렌더 -> 브라우저
```

수백건 짜리 배열이 브라우저로 바로 내려가는 것이 아니라 서버 컴포넌트에서 필터링 한다음 30건까지 줄여서 html로 렌더링하게된다.

## 당연하게도 이 방법은 만능은 아니다

그렇다면 이 방식은 언제 쓰는게 유리할까?

당연히 전체 데이터가 한 요청에 담길 정도로 작아야한다. 이 프로젝트의 경우에는 뮤지컬/연극 수가 아무래도 제한적이다보니 몇개월치의 결과도 많아야 수백 건이었다. 게다가 사용자들의 패턴 상 (동생 의견을 참고) 티켓팅도 아직 시작하지 않은 먼 미래의 공연을 조회할 일은 없을 것 같았다. 그래서 조회 범위를 3개월로 좁히고 날짜 피커가 정할 수 있는 범위도 그 상한 안으로 제한했다. 그래서 안받아온 날짜를 사용자가 검색하는 것을 구조적으로 방지했고 사용에도 무리가 없도록 범위를 좁힐 수 있었다.

그리고 데이터도 너무 자주 바뀌면 안됐다. 난 공연 정보는 실시간으로 바뀌는 류의 정보는 아니라고 봤는데, 아직 정확히 찍어보진 않았지만 나중에 같은 조합을 시간대별로 몇 번 찍어서 응답이 실제로 언제 달라지는지 보고 조절해보면 될 것 같다. 실시간 잔여 좌석 같은 걸 제공해야했으면 다른 얘기겠지만 mvp에서는 실시간 기능이 기획에 포함되지 않아 마찬가지로 이 설계에 적합했다.

반대로 API가 필터를 잘 지원하거나, 그렇지 않더라도 데이터가 너무 크거나 실시간으로 바뀌는 데이터라면 이 방식을 사용하기는 어려울 것이다.

## 배운점

Open API를 서비스에 붙일 때마다 느끼는건데 내가 제공하고자하는 서비스 의도와 안맞는 면이 있을때 설계 고민이 생기는 것 같다. 내가 원하는 방식의 응답이 아닐때마다 요리조리 고민해가면서 어떻게 해야 딱 내가 원하는 기능에 맞는 응답을 적절하게 가져올 수 있을지 고민하게 된다.

이번에는 특히 받아오는 데이터 형태도 형태지만 필터를 너무 빈약하게 제공해주고 있어서 더욱 고민이었다. 그런데 결국 필터를 어디서 걸지는 API가 아니라 캐시 키가 정하고 있었다. 캐시를 붙이겠다고 마음먹은 순간부터 사용자 입력은 URL에서 빠져야 했던 거다. 이걸 알고 나니 오히려 KOPIS가 장르 OR 조회를 안 해주는 것 같은 제약들이 알아서 정리됐다. 외부 API가 안 해주는 일은 어디서 대신할지만 정하면 된다는 것을 깨달았다.
