+++
date = '2026-09-30T00:00:00+09:00'
draft = false
title = 'Laying Out Multi-Day Events One Week at a Time'
description = "Event titles were getting cut off in a monthly calendar, so I stretched them across the event's duration, and the overflow covered other events and showtimes. I stopped stacking bars separately in each day cell, assigned lanes per week instead, and rendered the empty slots too."
tags = ["Design", "React", "CSS"]
+++

Think of Google Calendar. Add a three-day event and you get one long horizontal bar. Add several events and the bars arrange themselves, and when there are too many they collapse into something like +2. It all feels so natural that it never once occurred to me this might be hard to build.

Then I built it myself, and it was harder than I expected. I got a report that the title of a multi-day event was cut off in its first day's cell, so I stretched the title to the length of the bar. This time the longer title covered the showtimes in the next day's cell.

## Cells have to be tappable per day, and bars have to look continuous

Each calendar cell holds that day's showtimes (time and lead actor), and above them, events like opening night, closing night, stage greetings, and coupon giveaways are shown as duration bars. Every date cell is a button, so tapping a date opens that day's showtime cards below.

```tsx
<div className="grid grid-cols-7 gap-y-0.5">
  {cells.map((date, index) => {
    if (!date) return <div key={`blank-${index}`} />; // blank cells before the 1st

    return (
      <button key={date} type="button" onClick={() => setSelected(date)}>
        {/* date number, event bars, showtimes */}
      </button>
    );
  })}
</div>
```

But events span multiple days, so the bar and its title have to look like they continue across cells. I considered laying the bars over the calendar separately with `absolute`, but then I'd have to compute each bar's position and width from cell coordinates myself. The cells also had to stay tappable per date, so I decided to draw the bar inside the buttons, one piece per cell. A three-day bar is really three pieces.

## First: the title gets cut off in the first cell

At first, each cell listed that day's events vertically, and the title was written only in the cell where the event starts. But on a 360px-wide phone a cell is about 47px, so even a short title like `첫공 무대인사` (opening night stage greeting) didn't fit. ([title truncation issue](https://github.com/detourguru/hoejeonmun/issues/5))

![The title is trapped in the single starting cell and cut off, and bars that continue after the week changes, like on 10/4, have no name](/images/posts/calendar-event-lanes/1-before-title-in-first-cell.webp)

So I decided to draw the bar and the title separately. First, for each cell, I work out whether it's the start or the end of a bar. A cell is a start if it's the first cell of the week or the previous cell doesn't have the same event.

```ts
const start = index % DAYS_IN_WEEK === 0 || !isActiveAt(index - 1, event.id); // Sunday, or not in the previous cell
const end =
  index % DAYS_IN_WEEK === DAYS_IN_WEEK - 1 || !isActiveAt(index + 1, event.id); // Saturday, or not in the next cell
```

The bar is drawn one piece per cell, and adjoining pieces drop their rounded corners so they read as one continuous bar.

```tsx
<span
  className={cn(
    "relative h-3 border-b border-white",
    getEventBarColor(entry.event.title),
    entry.start && "ml-px rounded-l-sm", // round the left side only on the start cell
    entry.end && "mr-px rounded-r-sm", // round the right side only on the end cell
  )}
>
```

The title is positioned with `absolute` in the start cell only, and its width is stretched by the number of cells the bar continues through.

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

If `length` is 3, the title is drawn three cells wide. Past the last cell of a week, the title doesn't wrap down to the next week, it runs off the right edge of the screen, so I made it stop at Saturday.

```ts
let length = 1;

while (
  start &&
  (index + length) % DAYS_IN_WEEK !== 0 && // don't go past Saturday
  isActiveAt(index + length, event.id) // one more cell if the next one has the same event
) {
  length += 1;
}
```

## Second: the longer title covers the next cell's showtimes

Now the title shows for the full length of the bar. But a few days later another report came in: a title was covering other events and showtimes, like `스페셜 커튼콜` (special curtain call) in the screenshot below. ([title overlap issue](https://github.com/detourguru/hoejeonmun/issues/29))

![The special curtain call title stretched from the 10/4 cell covers the 15:00 showtime on 10/5](/images/posts/calendar-event-lanes/2-title-covers-next-day.webp)

The 4th has both `포토카드 증정` (photocard giveaway) and the special curtain call, so the bars stack in two rows. But the photocard giveaway ends on the 4th. The cell for the 5th stacks only that day's remaining events from the top, so the special curtain call bar moves up to the first row. The bar moved up, but the title stretched from the 4th was still in the second row, so it covered the 15:00 showtime on the 5th.

The cause was that each date cell decided on its own which row to draw a bar in. Events didn't have a lane of their own. Each cell drew whatever events existed that day, so the same event could land in a different row depending on the date. Title length was computed per event, while rows were decided per date. That mismatch was the problem.

So one event had to stay in the same row for the whole week. Before drawing any cells, I'd look at the whole week and give each event a row number first.

### Assign lanes a week at a time, first

Before drawing the cells, I loop once per week and collect the events that touch that week's seven cells.

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
      weekEvents.set(event.id, event); // an event spanning several cells is added only once
    }
  }
```

Then each event gets the list of cells it occupies this week (`span`) and is passed to the lane assignment function.

```ts
  const { laneOf, laneCount } = assignEventLanes(
    [...weekEvents.values()].map((event) => ({
      ...event,
      span: indexes.filter((index) => isActiveAt(index, event.id)),
    })),
  );
```

One more thing: `span` isn't every day from the start date to the end date. It only collects the dates where a bar is actually drawn. Bars aren't drawn on days without a performance, and some events skip days in the middle, so comparing by period alone would make an event claim cells it never draws in.

`assignEventLanes` sorts the events first.

```ts
const ordered = [...events].sort(
  (a, b) =>
    a.periodStart.localeCompare(b.periodStart) ||
    b.periodEnd.localeCompare(a.periodEnd) ||
    a.id - b.id,
);
```

This sort decides who gets to pick a spot first. Events that start earlier pick first, and among events starting the same day, the one that runs longer picks first. So among events that start on the same day, the long bar ends up in the first row. A long event often continues into the next week, where it's now the earliest-starting event and lands in the first row again. That means a long bar in the first row mostly stays in the first row when the week changes. The last condition, `a.id - b.id`, is there so the order doesn't change on every refresh.

Next, I take the events one at a time, check lanes from the top, and put each event in the first lane that's free.

```ts
const occupied: Set<number>[] = []; // occupied[lane number] = cells already taken in that lane
const laneOf = new Map<number, number>(); // event id -> lane number

for (const event of ordered) {
  let lane = 0;

  // if any cell I need in this lane is taken, move to the next lane
  while (
    occupied[lane]?.size &&
    event.span.some((at) => occupied[lane].has(at))
  ) {
    lane += 1;
  }

  occupied[lane] ??= new Set();

  for (const at of event.span) occupied[lane].add(at); // mark the cells I took

  laneOf.set(event.id, lane);
}

return { laneOf, laneCount: occupied.length };
```

Say event A runs Monday to Tuesday and B runs Tuesday to Thursday. Lane 0 (the first row) is empty, so A goes into lane 0 and fills the Monday and Tuesday cells. B is next. Lane 0 already has Tuesday taken, so B drops to lane 1 (the second row). B then stays in the second row from Tuesday through Thursday.

What happens when C, running Friday to Saturday, comes in? `lane` starts over from 0 for each event, and lane 0 only has Monday and Tuesday taken while Friday and Saturday are free, so C goes into the first row. Events whose dates don't overlap share a row.

```text
             Mon  Tue  Wed  Thu  Fri  Sat
first row    A    A              C    C
second row        B    B    B
```

This function originally lived inside the component's render function. A month later, when I added vitest, I [extracted it as `assignEventLanes`](https://github.com/detourguru/hoejeonmun/commit/b589b75) and pinned the rules above as [regression tests](https://github.com/detourguru/hoejeonmun/commit/c3b219b).

```ts
// span: the cells an event covers within one week (0 = Sun ~ 6 = Sat)
it("puts the longer-running event in the upper row when both start on the same day", () => {
  const { laneOf } = assignEventLanes([
    event(1, "2026-09-27", "2026-09-27", [0]),
    event(2, "2026-09-27", "2026-10-03", [0, 1, 2, 3, 4, 5, 6]),
  ]);

  expect(laneOf.get(2)).toBe(0);
  expect(laneOf.get(1)).toBe(1);
});
```

## Third: skipping empty rows breaks the alignment again

Even with lane numbers assigned, the same problem comes back if you skip empty rows when drawing. In the table below, Wednesday's cell has no A. If you don't leave the first row empty and pull B up instead, it no longer lines up with Tuesday's B, and the earlier bug returns.

```text
             Mon  Tue  Wed  Thu
first row    A    A    B    B
second row        B
```

So each cell gets as many slots as the week has lanes, and slots with no event are left as `null`.

```ts
const lanes: (LaneEntry | null)[] = Array.from(
  { length: barLanes },
  () => null,
);

for (const event of eventsByDate.get(date) ?? []) {
  const lane = laneOf.get(event.id) ?? 0;

  // compute start, end, length

  lanes[lane] = { event, start, end, length }; // only goes in its assigned lane slot
}
```

When rendering, `null` isn't skipped either. A transparent element with the same height as a bar goes in its place.

```tsx
{(lanesByIndex.get(index) ?? []).map((entry, lane) =>
  entry ? (
    <span key={entry.event.id} className={cn("relative h-3 border-b border-white", ...)}>
      {/* bar and title */}
    </span>
  ) : (
    <span key={`lane-${lane}`} className="h-3 border-b border-transparent" />
  ),
)}
```

There's more empty space now, but the title and the bar continue along the same row. Days without events take up the same height too, so the position where the showtimes begin also lines up within a week.

![After lane assignment. The special curtain call is in the first row on both 10/4 and 10/5, and a transparent span holds the empty second row on 10/10](/images/posts/calendar-event-lanes/4-week-lanes.webp)

### A cap for weeks with many events

If lanes keep growing, a week with many events could make its cells grow without limit. The cell also has to show showtimes below the bars. There are at most about three showtimes a day, but there can be any number of events, so I capped event rows at five.

```ts
const MAX_EVENT_LANES = 5;

const overflow = laneCount > MAX_EVENT_LANES;
const barLanes = overflow ? MAX_EVENT_LANES - 1 : laneCount;
```

Up to five lanes are drawn as they are. With six or more, only four rows of bars are drawn and the fifth row shows the number of events hidden that day, like `+2`. Events assigned to lanes past the cap aren't drawn, only counted.

```ts
if (lane >= barLanes) {
  hidden += 1;
  continue;
}
```

## What I learned

UIs that draw elements spanning several cells on a grid, like Gantt charts and timelines, are so common that I never thought building one would be hard. There turned out to be more tricky parts than I expected.

The hardest part was that the unit you tap is a cell, while the unit you see is a bar running across several cells. I learned that which row a bar goes in has to be decided first at the level above the cells that groups them (one week), and the cells should only draw in the row they were given.

It was a fun piece of work that showed me how many rules hide behind a UI I'd taken for granted. The next time I have to draw multi-cell elements on a grid, I think I'll know where to start.
