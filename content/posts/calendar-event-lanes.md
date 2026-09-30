+++
date = '2026-09-30T00:00:00+09:00'
draft = false
title = '여러 날짜를 차지하는 이벤트의 레이아웃을 주 단위로 설계하기'
description = '월간 달력에서 잘리는 이벤트 제목을 기간만큼 표시되게 했더니 overflow가 발생해 다른 이벤트와 회차를 덮었다. 그래서 날짜 칸마다 따로 쌓던 막대에 주 단위로 줄을 배정하고 빈자리도 그리도록 바꿨다.'
tags = ["설계", "React", "CSS"]
+++

구글 캘린더를 생각해보자. 3일짜리 일정을 넣으면 가로로 긴 막대 하나가 생길 것이다. 일정이 여러 개면 알아서 일정 막대가 생기고, 너무 많으면 +2 같은 표시로 접힌다. 이 동작이 너무 자연스러워서 이게 구현하기 어렵다는 생각을 한 번도 해본 적이 없다.

그런데 직접 만들어보니 생각보다 어려웠다. 여러 날에 걸친 이벤트 제목이 첫날 칸에서 잘린다는 제보를 받고 제목을 막대 길이만큼 늘렸더니, 이번엔 길어진 제목이 다음 날 칸의 공연 회차를 덮어버렸다.

## 칸은 날짜마다 눌려야 하고 막대는 이어져야 한다

달력 한 칸에는 그날의 회차(시간과 주연 배우)가 들어가고, 그 위에 첫공, 막공, 무대인사, 쿠폰 증정 같은 이벤트가 기간 막대로 표시된다. 날짜 칸은 하나하나가 버튼이라 날짜를 누르면 아래에 그날 회차 카드가 열린다.

```tsx
<div className="grid grid-cols-7 gap-y-0.5">
  {cells.map((date, index) => {
    if (!date) return <div key={`blank-${index}`} />; // 1일 앞의 빈칸

    return (
      <button key={date} type="button" onClick={() => setSelected(date)}>
        {/* 날짜 숫자, 이벤트 막대, 회차 */}
      </button>
    );
  })}
</div>
```

그런데 이벤트는 여러 날에 걸쳐 있어서 막대와 제목은 칸을 넘어 이어져 보여야 한다. 달력 위에 막대만 `absolute`로 따로 얹는 방법도 생각해봤지만 그러려면 막대의 위치와 너비를 칸 좌표로 직접 계산해야 했다. 칸은 날짜별로 눌려야 하기도 해서 막대도 버튼 안에 칸마다 조각으로 그리기로 했다. 그러니까 3일짜리 막대는 실제로는 세 조각이다.

## 첫 번째: 제목이 첫 칸에서 잘린다

처음에는 칸마다 그날 걸린 이벤트를 세로로 나열하고 이벤트가 시작하는 칸에만 제목을 적었다. 그런데 360px 폭 폰에서는 한 칸이 47px 정도라 `첫공 무대인사` 같은 짧은 제목도 다 안 들어갔다. ([제목 잘림 이슈](https://github.com/detourguru/hoejeonmun/issues/5))

![제목이 시작 칸 한 칸에 갇혀 잘리고, 10/4처럼 주가 바뀐 뒤의 막대는 이름이 없다](/images/posts/calendar-event-lanes/1-before-title-in-first-cell.webp)

그래서 막대와 제목을 따로 그리기로 했다. 먼저 칸마다 이 칸이 막대의 시작인지 끝인지를 구한다. 그 주의 첫 칸이거나 바로 앞 칸에 같은 이벤트가 없으면 시작 칸이다.

```ts
const start = index % DAYS_IN_WEEK === 0 || !isActiveAt(index - 1, event.id); // 일요일이거나 앞 칸에 없으면 시작
const end =
  index % DAYS_IN_WEEK === DAYS_IN_WEEK - 1 || !isActiveAt(index + 1, event.id); // 토요일이거나 뒤 칸에 없으면 끝
```

막대는 칸마다 한 조각씩 그리되 이어지는 칸끼리는 모서리에 round 스타일을 없애서 이어진 하나로 보이게 했다.

```tsx
<span
  className={cn(
    "relative h-3 border-b border-white",
    getEventBarColor(entry.event.title),
    entry.start && "ml-px rounded-l-sm", // 시작 칸만 왼쪽을 둥글게
    entry.end && "mr-px rounded-r-sm", // 끝 칸만 오른쪽을 둥글게
  )}
>
```

제목은 시작 칸에만 `absolute`로 띄우고 너비를 이어지는 칸 수만큼 늘렸다.

```tsx
{entry.start && (
  <span
    className="text-text absolute inset-y-0 left-0 z-10 truncate px-1 text-left text-[9px] leading-3 font-bold"
    style={{ width: `${entry.length * 100}%` }}
  >
    {entry.event.title}
  </span>
)}
```

`length`가 3이면 제목이 세 칸 너비로 그려진다. 한 주의 마지막 칸을 넘기면 제목이 다음 주로 내려가는 게 아니라 화면 오른쪽 밖으로 나가버리기 때문에 토요일에서 끊게 작업했다.

```ts
let length = 1;

while (
  start &&
  (index + length) % DAYS_IN_WEEK !== 0 && // 토요일을 넘기지 않는다
  isActiveAt(index + length, event.id) // 다음 칸에도 같은 이벤트가 있으면 한 칸 더
) {
  length += 1;
}
```

## 두 번째: 길어진 제목이 옆 칸의 회차를 덮는다

제목은 이제 막대 길이만큼 보인다. 그런데 며칠 뒤 이번엔 아래 사진의 `스페셜 커튼콜` 쪽처럼 제목이 다른 이벤트나 회차를 덮는다는 제보가 들어왔다. ([제목 겹침 이슈](https://github.com/detourguru/hoejeonmun/issues/29))

![10/4 칸에서 늘어난 스페셜 커튼콜 제목이 10/5의 15:00 회차를 덮고 있다](/images/posts/calendar-event-lanes/2-title-covers-next-day.webp)

4일에는 `포토카드 증정`과 `스페셜 커튼콜`이 둘 다 있어서 막대가 두 줄로 쌓인다. 그런데 `포토카드 증정`은 4일에 끝난다. 5일 칸은 그날 남은 이벤트만 위에서부터 쌓으니까 `스페셜 커튼콜` 막대가 첫째 줄로 올라간다. 막대는 올라갔는데 4일에서 길어진 제목은 그대로 둘째 줄에 있어서 5일의 15:00 회차를 덮은 것이다.

원인은 막대를 몇 번째 줄에 그릴지를 날짜 칸이 각자 정하고 있었기 때문이다. 각 이벤트가 각자의 레인을 가지고 있는 게 아니라 그날그날 이벤트 존재 여부로 칸마다 이벤트를 그리다보니 같은 이벤트라도 날짜에 따라 다른 줄에 놓일 수 있다. 제목 길이는 이벤트 단위로 계산하면서 줄은 날짜마다 따로 정하고 있었던 것이 문제였다.

그러니 이벤트 하나는 한 주 안에서 계속 같은 줄에 있어야 했다. 칸을 그리기 전에 한 주 전체를 보고 이벤트마다 줄 번호를 먼저 정해주기로 했다.

### 한 주 단위로 레인을 먼저 배정하자

칸을 그리기 전에 주마다 한 번씩 돌면서 그 주 일곱 칸에 걸린 이벤트를 모은다.

```ts
for (let week = 0; week * DAYS_IN_WEEK < cells.length; week += 1) {
  const from = week * DAYS_IN_WEEK;
  const indexes = Array.from(
    { length: DAYS_IN_WEEK },
    (_, offset) => from + offset,
  ).filter((index) => index < cells.length);

  const weekEvents = new Map<number, CalendarEvent>();

  for (const index of indexes) {
    for (const event of eventsByDate.get(cells[index] ?? "") ?? []) {
      weekEvents.set(event.id, event); // 여러 칸에 걸린 이벤트도 한 번만 담는다
    }
  }
```

그리고 이벤트마다 이번 주에 몇 번째 칸들을 차지하는지(`span`)를 붙여서 레인 배정 함수에 넘긴다.

```ts
  const { laneOf, laneCount } = assignEventLanes(
    [...weekEvents.values()].map((event) => ({
      ...event,
      span: indexes.filter((index) => isActiveAt(index, event.id)),
    })),
  );
```

아 그리고 `span`은 시작일부터 종료일까지 전부가 아니라 실제로 막대가 그려지는 날짜만 모은 것이다. 공연 없는 날에는 막대를 안 그리고 중간에 빠지는 날이 있기도 한데 기간만 보고 비교하면 그리지도 않는 칸까지 차지하게 될 수 있기 때문이다.

`assignEventLanes`는 먼저 이벤트를 정렬한다.

```ts
const ordered = [...events].sort(
  (a, b) =>
    a.periodStart.localeCompare(b.periodStart) ||
    b.periodEnd.localeCompare(a.periodEnd) ||
    a.id - b.id,
);
```

이 정렬은 누가 먼저 자리를 잡을지를 정한다. 먼저 시작하는 이벤트부터 자리를 잡고, 시작일이 같으면 더 오래 가는 이벤트가 먼저 잡는다. 그래서 같은 날 시작한 이벤트끼리는 긴 막대가 첫째 줄에 온다. 긴 이벤트는 다음 주까지 이어지는 경우가 많은데 다음 주에는 가장 먼저 시작한 이벤트가 되어 첫째 줄에 온다. 그래서 첫째 줄에 있던 긴 막대는 주가 바뀌어도 대부분 첫째 줄에 남는다. 마지막 `a.id - b.id` 조건은 새로고침할 때마다 순서가 바뀌지 않게 하려고 넣었다.

그다음 이벤트를 하나씩 꺼내서 위쪽 레인부터 확인하고 비어 있는 첫 레인에 넣는다.

```ts
const occupied: Set<number>[] = []; // occupied[레인 번호] = 그 레인에서 이미 찬 칸들
const laneOf = new Map<number, number>(); // 이벤트 id -> 레인 번호

for (const event of ordered) {
  let lane = 0;

  // 이 레인에 내가 들어갈 칸이 하나라도 차 있으면 다음 레인으로
  while (
    occupied[lane]?.size &&
    event.span.some((at) => occupied[lane].has(at))
  ) {
    lane += 1;
  }

  occupied[lane] ??= new Set();

  for (const at of event.span) occupied[lane].add(at); // 내가 들어간 칸을 찼다고 표시

  laneOf.set(event.id, lane);
}

return { laneOf, laneCount: occupied.length };
```

A는 월~화, B는 화~목인 이벤트라고 가정해보자. 0번 레인(첫째 줄)이 비어 있으니 A는 0번에 들어가고 월, 화 칸이 찬다. 다음은 B다. 0번 레인은 화요일 칸이 이미 차 있어서 1번 레인(둘째 줄)으로 내려간다. 그래서 B는 화요일부터 목요일까지 계속 둘째 줄에 있게 된다.

여기에 금~토인 C가 들어오면 어떻게 될까? `lane`은 이벤트마다 0부터 다시 시작하기 때문에 0번 레인은 월, 화만 차 있고 금, 토는 비어 있으니 C는 첫째 줄에 들어간다. 날짜가 안 겹치는 이벤트끼리는 같은 줄을 같이 쓰는 것이다.

```text
          월   화   수   목   금   토
첫째 줄   A    A              C    C
둘째 줄        B    B    B
```

이 함수는 처음엔 컴포넌트 렌더 함수 안에 있었다. 한 달 뒤 vitest를 붙이면서 [`assignEventLanes`로 분리](https://github.com/detourguru/hoejeonmun/commit/b589b75)했고 위 규칙들을 [회귀 테스트](https://github.com/detourguru/hoejeonmun/commit/c3b219b)로 남겼다.

```ts
// span: 한 주(0=일 ~ 6=토) 안에서 이벤트가 걸친 칸
it("같은 날 시작하면 더 길게 이어지는 이벤트가 위 줄에 온다", () => {
  const { laneOf } = assignEventLanes([
    event(1, "2026-09-27", "2026-09-27", [0]),
    event(2, "2026-09-27", "2026-10-03", [0, 1, 2, 3, 4, 5, 6]),
  ]);

  expect(laneOf.get(2)).toBe(0);
  expect(laneOf.get(1)).toBe(1);
});
```

## 세 번째: 빈 줄을 건너뛰면 다시 어긋난다

레인 번호를 정해도 빈 줄을 건너뛰고 그리면 같은 문제가 다시 생긴다. 아래 표의 수요일 칸에는 A가 없다. 그렇다고 첫째 줄을 비워두지 않고 B를 위로 당겨 그리면 화요일의 B와 이어지지 않게 되어 이전의 문제가 재발한다.

```text
          월   화   수   목
첫째 줄   A    A    B    B
둘째 줄        B
```

그래서 칸마다 그 주의 레인 수만큼 자리를 만들고 이벤트가 없는 자리는 `null`로 남겼다.

```ts
const lanes: (LaneEntry | null)[] = Array.from(
  { length: barLanes },
  () => null,
);

for (const event of eventsByDate.get(date) ?? []) {
  const lane = laneOf.get(event.id) ?? 0;

  // start, end, length 계산

  lanes[lane] = { event, start, end, length }; // 배정받은 레인 자리에만 넣는다
}
```

그릴 때도 `null`을 건너뛰지 않고 막대와 같은 높이의 투명한 요소를 넣는다.

```tsx
{(lanesByIndex.get(index) ?? []).map((entry, lane) =>
  entry ? (
    <span key={entry.event.id} className={cn("relative h-3 border-b border-white", ...)}>
      {/* 막대와 제목 */}
    </span>
  ) : (
    <span key={`lane-${lane}`} className="h-3 border-b border-transparent" />
  ),
)}
```

빈 공간은 늘었지만 제목과 막대가 같은 줄에서 이어진다. 이벤트가 없는 날도 같은 높이를 차지하니까 그 아래 회차가 시작하는 위치도 한 주 안에서 맞출 수 있다.

![레인 배정 후. 스페셜 커튼콜은 10/4와 10/5 모두 첫째 줄에 있고, 10/10의 빈 둘째 줄은 투명 span이 자리를 지킨다](/images/posts/calendar-event-lanes/4-week-lanes.webp)

### 이벤트가 많은 주에는 상한을 뒀다

레인을 계속 늘리면 이벤트가 많은 주는 칸이 끝없이 늘어날 수 있다. 칸 아래에는 회차도 보여줘야 한다. 회차는 하루에 많아야 3개 정도지만 이벤트는 얼마든지 많아질 수 있어서 이벤트 줄을 최대 다섯 개로 제한했다.

```ts
const MAX_EVENT_LANES = 5;

const overflow = laneCount > MAX_EVENT_LANES;
const barLanes = overflow ? MAX_EVENT_LANES - 1 : laneCount;
```

레인이 다섯 개까지면 그대로 그린다. 여섯 개 이상이면 막대는 네 줄만 그리고 다섯째 줄에는 그날 숨겨진 이벤트 수를 `+2`처럼 적는다. 상한을 넘는 레인에 배정된 이벤트는 그리지 않고 개수만 센다.

```ts
if (lane >= barLanes) {
  hidden += 1;
  continue;
}
```

## 배운점

간트 차트나 타임라인처럼 여러 칸에 걸친 요소를 격자 위에 그리는 UI는 너무 흔해서 사실 구현이 어려울거란 생각을 해보지도 않았는데 생각보다 까다로운 요소가 많았다.

클릭되는 단위는 칸인데 보여주는 단위는 여러 칸에 이어진 막대라는 부분이 특히 어려웠다. 막대를 몇 번째 줄에 그릴지는 각각의 칸이 아니라 칸을 묶는 상위 단위(한 주)에서 먼저 정한 다음에, 칸은 정해진 줄에 그리기만 해야 한다는 것을 알게 되었다.

당연하게 쓰던 UI일수록 그 동작 뒤에 규칙이 숨어 있다는 걸 알게 된 재밌는 작업이었다. 다음에 격자 위에 여러 칸짜리 요소를 그릴 일이 생기면 이젠 어디서부터 시작해야 할지 알 것 같다.