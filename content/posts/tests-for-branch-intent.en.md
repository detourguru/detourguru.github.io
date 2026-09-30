+++
date = '2026-09-29T00:00:00+09:00'
draft = false
title = 'Writing Tests Surfaces Intent the Code Never Stated'
description = "In a solo project, every time I fixed a feature or added a branch, manual testing was the only way to check I hadn't broken the existing intent. So I wrote tests based on every branch and every past bug. Along the way I found hidden bugs, and I recorded the intent of branches whose reasons weren't written anywhere as test titles."
tags = ["Testing"]
+++

Fixing one feature and watching a seemingly unrelated screen break is probably something every developer has been through at least once. And when you develop alone, there's nobody to tell you, so users often find it first.

Hoejeonmun, a service I built, was exactly this case. You upload a casting board image, and AI reads it and organizes the performers by date. The AI's output can't be trusted, so the code filters it once more. Every time an error report came in, another condition got added, and that validation logic grew to nearly 880 lines in a single file.

But with no tests, every time I added a branch, the only way to check that the existing branches still did what they were meant to do was to test the feature by hand. The biggest problem was that the manual testing surface was wide, so when a bug I'd already fixed came back because of another change, I had no way of knowing.

## The criteria for adding tests

The reasons I needed tests were clear.

- Bugs I'd already fixed came back.
- The rules filtering the AI parsing results kept growing and were never verified.
- As a solo developer, nobody could check whether my changes were right. Sometimes I learned about problems from user bug reports.

The codebase was fairly large, so it was hard to know which scenarios to cover and where to begin.
So I first narrowed the scope to pure functions and set two criteria: a test for every branch of each pure function, and for every bug that had occurred, a test that reproduces it.

### One case per branch

For example, the function that filters the date badges read by the AI (labels like preview or closing night) is built from a condition like this.

```ts
const isValid =
  tag.length > 0 && // does the badge have a name?
  DATE_PATTERN.test(startDate) && // is the date format valid?
  startDate <= endDate && // is the start date no later than the end date?
  startDate >= from && // is it within the show's run?
  endDate <= to &&
  agreesWithPrintedWeekday(startDate, printedStartWeekday) && // does the printed weekday match the actual date?
  ... // 11 conditions in total, including showtime and uploaded image index checks
```

Each of these conditions stands for one way the AI can be wrong. If any one fails, the badge is skipped. The trouble was that with this many conditions, when one failed it was hard to see right away which one and why. And if a condition got dropped during a code change? That could be hard to notice too.

So I wrote tests that verify these branches, like this.

```ts
it.each<[string, ParsedDateTag]>([
  ["the badge name is empty", dateTag(" ", "2026-09-28", "2026-09-28")],
  ["the start date is later than the end date", dateTag("프리뷰", "2026-09-29", "2026-09-28")],
  ["the printed weekday differs from the actual weekday", dateTag("프리뷰", "2026-09-28", "2026-09-28", { printedStartWeekday: "화" })],
  ["a showtime badge spans a period instead of a single day", dateTag("막공", "2026-09-28", "2026-09-29", { time: "19:30" })],
  ...
])("discards it when %s", (_, invalid) => {
  expect(normalize([invalid])).toStrictEqual([]);
});
```

After writing a test, I always broke the original code and checked for myself that the test failed. Otherwise you can end up with a useless test that passes no matter what.

Cases that must not be discarded were pinned with tests the same way. One such condition was `an agency-announced event is not discarded even if the printed weekday doesn't match the date`. Events posted on an agency's social media may contain typos, so instead of discarding them, the uploader is asked to confirm.

```ts
it("does not discard it when the weekday doesn't match the date, since it may be a typo (asks for confirmation on the review screen)", ...);
```

### A regression test for every past bug

The second criterion was tests for bugs that had already happened. I went through the commit messages with a fix prefix and added a test that fails when that bug comes back. For example, the KOPIS API sometimes returned 400 for valid requests, so I had added retries and a limit on concurrent requests. That got tests like these.

```ts
it("requests again and gets the result when KOPIS intermittently returns 400", ...);
it("sends at most 8 requests to KOPIS at a time even when many lookups run at once", ...);
```

The logic that reads queries of over 1,000 rows in chunks, and the logic that splits calendar event titles into rows so they don't overlap, got tests the same way.

## Some bugs turned up while writing the tests

The function that strips "등" (meaning "and others") from the end of a cast list like "정휘 등" used the regex `/등$/`, so any actor whose name itself ends in "등" was losing the last character. If an actor were named `신호등`, only `신호` could remain. I changed the regex to `/ 등$/` so it strips only when there's a space before "등". It's the kind of bug I wouldn't have known about until an actor whose name ends in "등" showed up, had I not written the test.

There were also cases where it was unclear whether it was a bug or a product decision. My schedule marks performances whose times overlap, but a performance starting exactly when the previous one ends was reported as not overlapping. A 12:00–13:00 show and a 13:00–14:00 show don't overlap by calculation, but realistically you can't watch a show that ends at 13:00 and then get to one that starts at 13:00. Treating them as overlapping made more sense from the service's point of view, so I changed this too.

## Well-written test scenarios are a record of decisions

To write a test you have to know why a branch exists and what it does. But now and then there were branches whose reason was nowhere in the code. This function decides whether a newly read event is a duplicate of one already saved.

```ts
export const isExactSameEvent = (event, candidate) =>
  !candidate.edited &&
  event.periodStart === candidate.periodStart &&
  // ...
```

Why would an event someone had corrected not count as a duplicate even when the content is identical? I'd written it so long ago that I couldn't remember why the branch existed. I dug through the commit history, but it had slipped in with an unrelated commit that fixed role ordering, and there was no explanation.

So I followed the call sites. When a newly read event is judged to be the same as an existing one, it's merged into the existing event without asking the uploader, and the screen shows the one that came in later (since it's the latest version). But this function only compares the title and the period. So even if someone has manually corrected an event's description, when the AI reads the same announcement again, the title and period match and it gets merged, and the description the user fixed could be replaced by the one the AI read. This condition was a branch that stops a human-corrected event from being merged automatically with what the AI reads again.

Once I'd found the reason, I added a comment on the branch and spelled it out in the test title too. If someone tries to remove this condition later, the test will tell them why through its title.

```ts
it("excludes a corrected event from automatic merging so the latest version doesn't hide the correction", () => {
  expect(isExactSameEvent(pending, existing({ edited: true }))).toBe(false);
});
```

## What I learned

I should have written tests from the start, but I was trying to ship an MVP fast and kept telling myself `I'll do it after this one feature`, and the tests ended up coming far too late. It was code I wrote myself, and yet after only a few weeks I was unsure why a branch existed, and dead code had appeared in the meantime...

So I worked hard on the pure functions first. Test patterns I was writing for the first time I learned and wrote myself, and for tests of a similar shape I settled the scenarios and asked AI to write them. I also broke things on purpose and reviewed whether each test was unnecessary. In the end there were over 60 test commits and about 500 tests.

Component tests and DB tests are still a big mountain ahead, so overall coverage is low, but at least most of the pure functions are covered.

| Scope | Branch coverage |
|---|---|
| `src` | 18.7% |
| AI result validation and cleanup (`normalize.ts`) | 89.5% |
| Show list filtering and sorting (`show.ts`) | 89.7% |
| KOPIS lookup and retry (`kopis.ts`) | 95.7% |

Writing tests all at once was exhausting, and it was harder still when I didn't know the reason behind a branch. I felt very keenly that tests should be written whenever a feature is added. To avoid repeating the same mistake, I also set a coverage floor in CI, a little below the current level, so code without tests can't keep growing.

I started adding tests to stop bugs from coming back, but while writing them I came to care a lot about writing test titles in more detail, like a record of decisions. From now on I plan to record the decisions I make and the bugs that occur in test titles, reasons included, as they happen, so they don't pile up into debt.
