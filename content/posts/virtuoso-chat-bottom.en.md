+++
date = '2026-09-15T17:43:47+09:00'
draft = false
title = 'I Turned Off Virtualization to Fix Virtual Scrolling'
description = "Two root causes behind react-virtuoso chat drifting off the bottom, the maintainer's answer, and four workarounds I tried myself, with reproduction results."
tags = ["React", "Debugging", "Performance"]
series = ['Chat Virtual Scroll Troubleshooting']
+++

When I first heard we needed real-time multi-user chat on the web, the first thing that came to mind was performance. I figured I was in for a long fight with optimization. On top of that, our product has animated message entrances, and every message differs in length and timing, so coordinating all of that was its own job. (Scrolling wasn't simple either — we had to support smart scroll with more than two conditions, plus auto-scroll and manual scroll, all at once.)

That's why, around August 2025 when we introduced virtual scrolling, the first thing I tried was TanStack's react-virtual — the well-known one. But the auto-scroll logic I'd already written didn't work on top of a virtual list. Rewriting the follow-the-bottom logic on top of TanStack seemed slower than just rendering the last 100 messages and calling it a day, so I ended up hand-rolling windowing myself. As a junior frontend engineer, this was way too much to take on, and maintaining it wasn't easy either.

And the real problem was auto-scroll kept breaking. Out of desperation I started searching things like `virtual list auto scroll bottom`, and that's how I found react-virtuoso's docs — which actually advertised chat as a use case front and center. Checking it out, it had everything I needed: `followOutput`, `firstItemIndex`, `startReached`. So around February 2026 I moved the whole scroll logic over to this library.

But then a new problem showed up. A new message would come in, and instead of sticking to the bottom, the scroll would stop a few dozen pixels short. And even while sitting still at the bottom, the scroll would jitter up and down every time a message arrived. (I unpacked why these two symptoms keep recurring, from a coordinate-system angle, in an [earlier post](/posts/virtuoso-manual-correction/) — Korean only for now. Here I'll focus on the two symptoms themselves and the workarounds.)

## Symptom A: The Scroll Doesn't Keep Up With New Messages

When you use `followOutput`, which follows new messages while at the bottom, or `scrollToIndex({ index: 'LAST', align: 'end' })`, which jumps to the last message, virtuoso roughly computes the scroll target like this.

```text
targetScrollTop =
  lastItemTop        // where the last message starts
  + lastItemHeight   // last message height (estimated)
  - viewportHeight   // viewport height
```

Say the last message starts at 5000px and the viewport is 800px tall. If virtuoso hasn't measured that item's height yet, it has no way of knowing the real height. So it substitutes the height it got from the first item, or `defaultItemHeight`. If that estimated height comes out to 80px, the target becomes 4280px (5000 + 80 - 800 = 4280).

But what if the real height is bigger than the estimate? Say it's actually 240px — then the real bottom is 4440px (5000 + 240 - 800 = 4440). The scroll stops 160px short.

virtuoso does have retry logic, so most of the time this gets corrected once measurement finishes. But what if the item's height grows after the scroll has already finished? A late-loading image, an animation that changes the item's height, buttons or options that get attached after render, text that keeps streaming in... (yes, all of these actually happened in our product.)

For items like these, the order between the scroll happening and the size settling can't help but vary every time. If the timing lines up and the size settles first, the scroll follows correctly. But if the scroll finishes first, it stops short of the bottom by however much the item grew afterward.

I thought I was the only one running into this, but similar reports were sitting right there on virtuoso's GitHub issues. [#1273](https://github.com/petyosi/react-virtuoso/issues/1273) reports the scroll stopping mid-item when messages are added in quick succession (the maintainer guessed margin was the culprit).

[#1447](https://github.com/petyosi/react-virtuoso/issues/1447) in particular points out that the formula above uses a default value before measurement happens, and the maintainer commented that you'd need to scroll first in order to measure the size. Honestly, this is exactly where I got stuck too. `To scroll accurately -> you need to know the height -> to know the height -> you need to render first -> and after rendering -> the height changes`. As of September 2026, when I'm writing this, issue 1447 is still open.

## Symptom B: The Scroll Jumps as Messages Pile Up, and Past Animations Replay

virtuoso pre-renders a slightly wider range than what's actually visible on screen (overscan). Items that fall outside the overscan range get removed from the DOM. When it removes them, it remembers their height, because it needs the total list height to size the scrollbar correctly. Then when a removed item comes back into view, it gets re-rendered as a brand new DOM node. That makes it an observation target again, and in the process its size gets measured again.

The problem is this newly measured height can differ from the one it remembered — the viewport width might have changed, or state might have reset during remounting and changed the element's size. When that happens, the total list height shifts by that difference, and the scroll position gets adjusted along with it. So a screen that should be sitting still ends up looking like it's jittering up and down.

If `followOutput` is turned on, there's one more symptom on top of that. While measurements are fluctuating, the at-the-bottom judgment gets it wrong and scrolls to the wrong position, causing a scroll jump.

Since virtuoso measures each element's size with `ResizeObserver`, avoiding the re-measurement of items that get treated as new DOM nodes means either not removing them at all, or making sure re-measuring produces the same value.

## Fixes the Maintainer Suggested

### Do You Have Margin Somewhere?

In virtuoso's official troubleshooting docs, the very first cause they list for this kind of symptom is margin. As mentioned above, virtuoso measures item height with `ResizeObserver`, and that measurement doesn't include margin. So if an item has margin, that amount gets dropped from the measurement entirely, the total height comes out smaller than reality, and the scroll can fall short of the actual bottom — so it's better to express spacing with padding instead.

### Try Virtuoso Message List

Looking through the issue tracker, it seems like quite a few users run into similar symptoms. And judging by the issue numbers alone, this is a pretty old (?) problem. ([#127](https://github.com/petyosi/react-virtuoso/issues/127), [#199](https://github.com/petyosi/react-virtuoso/issues/199), [#1273](https://github.com/petyosi/react-virtuoso/issues/1273), [#1447](https://github.com/petyosi/react-virtuoso/issues/1447)).

The maintainer's stance on these issues has been fairly consistent — they're actively reviewing and merging fixes for problems like this, but they've also said outright that fully stabilizing chat scroll has limits under the current architecture, and that [removing that limit would require changing the layout approach itself](https://github.com/petyosi/react-virtuoso/pull/1493).

Alongside that, they recommend [Virtuoso Message List](https://virtuoso.dev/message-list) for chat. In a test where they loaded past history and then scrolled up, regular virtuoso shifted by about 85px, while Message List moved less than 1px. That would probably help a lot with the `B` symptom I ran into, but it's a commercial license, so it costs money. They've also answered that you should specify image and video dimensions ahead of time so the size doesn't change after render ([#1083](https://github.com/petyosi/react-virtuoso/discussions/1083)).

In the end, these two symptoms are what happens when a library built around normal-flow layout — items stacking sequentially — meets a requirement of per-item variable height, post-render size changes, and pinning to the bottom, all at once.

## Workarounds I Tried

I've listed these from lowest cost to highest. None of them was a silver bullet on its own — I ended up mixing all of them together.

### 1. Lock Down Item Height at Mount Time

The first approach is to just remove the cause of the symptom. For images, reserving space up front with `width`/`height` or `aspect-ratio` keeps the height the same before and after loading. This is also what the maintainer recommends — make sure height doesn't change after render.

Virtualization removes and re-renders off-screen messages, and that wipes out component state — so the entrance animation for a message that already appeared plays again from scratch. So I started tracking whether an animation already played, keyed by message id, and only play it the first time a message appears. And in case some animation ends up changing height, I restricted animations to `transform` and `opacity` only, so they never touch height.

The key part here is keeping the played-animation record outside the component. If you keep it inside, it disappears the moment the component unmounts, and the whole thing is pointless.

```tsx
const playedEntryIds = new Set<string>()
 
function MessageRow({ message }: { message: Message }) {
  const [animate] = useState(() => !playedEntryIds.has(message.id))
  useEffect(() => {
    playedEntryIds.add(message.id)
  }, [message.id])
  return <div className={animate ? 'animate-fade-in' : undefined}>{/* ... */}</div>
}
```

That said, this only works if the server sends down image dimensions, and for messages that stream in token by token, like AI responses, there's no way to know the height ahead of time — so I couldn't apply this everywhere.

### 2. Keep Items Near the Bottom From Unmounting

The main cause of symptom `B` was items near the bottom cycling through unmount and mount, resetting state and letting their height change each time — because, as I mentioned in #1, virtualization re-renders them. So what if items near the bottom just never got unmounted at all? I set `increaseViewportBy.top` to a large value and capped the list length.

```tsx
const MAX_MESSAGES = 60 // list cap
const MAX_ROW_HEIGHT = 200 // largest estimated height among items

// always set top large enough that MAX_MESSAGES * MAX_ROW_HEIGHT < increaseViewportBy.top
<Virtuoso increaseViewportBy={{ top: 20000, bottom: 1200 }} /* ... */ />
```

`MAX_MESSAGES * MAX_ROW_HEIGHT < increaseViewportBy.top`. So as long as the total height of all the items stays under `increaseViewportBy.top`, the whole list always stays inside the render range whenever the scroll is at the bottom.

As you can see, this pixel-based approach lives or dies on how close the `MAX_ROW_HEIGHT` estimate is to the real maximum item height. If it ever exceeds `increaseViewportBy.top`, the scroll-not-reaching-bottom issue comes right back. And that's exactly what happened — when I set this value to 3000px, once enough messages piled up, the scroll started stopping short and jumping again.

One thing to watch out for with this approach is that virtualization is effectively turned off near the bottom. Performance no longer comes from virtualization — it's the list cap that decides performance now, and virtuoso's measurement cost is still there. If your product also needs infinite scroll into old history, like ours does, you need to design when the cap kicks in within the visible screen too. For example, holding off on trimming while someone's browsing old messages, and trimming again once they return to the bottom.

#### The minOverscanItemCount Option

There's also a way to cap it by item count, `MAX_MESSAGES`, instead of pixels — using the `minOverscanItemCount` option. The [release notes](https://virtuoso.dev/react-virtuoso/changelog/) describe it as meant for large items that `increaseViewportBy` can't handle, or for collapsible/expandable items.

```tsx
<Virtuoso minOverscanItemCount={{ top: MAX_MESSAGES, bottom: 0 }} /* ... */ />
```

This one doesn't need a `MAX_ROW_HEIGHT` estimate at all, so it looked like it might solve my `B` symptom outright. But when I tested it, it did stop the jump caused by remounting, but a wobble remained where `scrollHeight` would shrink and grow by up to nearly 110px whenever a message was added. And if the initially loaded list had any messages that grow after render mixed in, 3 out of 5 times it would remount well over a thousand times in a row and end up more than 5000px away from the bottom. I never nailed down the cause, but it didn't seem like something I could just swap in, so I didn't adopt it.

### 3. Pin to the Bottom Myself Instead of followOutput

`followOutput` is the option that follows new messages while the scroll is at the bottom. But if it finishes its calculation and sticks the scroll to the bottom, and then an item's height suddenly changes, the scroll falls away from the bottom. And since it's no longer technically at the bottom at that point, it won't follow again — so you get scroll that doesn't stick to the bottom. So in our product I turned `followOutput` off and implemented the same behavior myself.

```ts
let pinned = startsAtBottom // false if the screen starts mid-list, like landing on unread messages

// only release the scroll lock when the user manually scrolls up
scroller.addEventListener('scroll', () => {
  const atBottom = distanceToBottom() <= 1
  const userScrolledUp = scrolledUp() && !contentShrank()

  if (atBottom) pinned = true
  // releasing it to false based on distance-to-bottom misjudged "not at bottom" when messages
  // were arriving fast, so release it based on the user scrolling up instead
  else if (userScrolledUp) pinned = false 
})

// when the chat list's size changes, jump to the bottom only if scroll is pinned
new ResizeObserver(() => {
  if (pinned) scroller.scrollTop = scroller.scrollHeight
}).observe(list)
```

If I just reimplemented what `followOutput` already did, it might not be obvious what actually changed — the difference is in the condition being checked.

| | When | Condition | Where to |
|---|---|---|---|
| `followOutput` | When a message is added | If currently at the bottom | To the calculated position |
| Custom implementation | When the list size changes | If the user hasn't left the bottom | To the actual end |

At first I tried continuously pulling the scroll down to the bottom for a fixed duration whenever a message arrived, but that ended up fighting virtuoso's re-measurement and made the jitter worse. It only settled down once I switched to reacting only when the size actually changed.

Testing it out, everything stuck to the bottom fine when messages arrived slowly, but adding them fast still left the scroll short of the bottom. So it didn't work well on its own, but combined with #2 above, it worked well.

### 4. Non-Virtual for What's Visible, Virtual for What's Not

Honestly, this approach is the cleanest. Render recent items as plain DOM so the browser handles layout and bottom-pinning itself, and only virtualize the older history that's off-screen.

I actually ran a few tests toward adopting this. For the non-virtualized list, bottom-pinning could be handled by watching content height changes with `ResizeObserver` and following along when near the bottom. But the problem was everything else that was left: items transitioning from non-virtual to virtual, scroll alignment on screen transitions, infinite scroll into old history, and so on. The scope was basically rebuilding the entire chat list from scratch.

This screen is the most important one in our product, and nearly all of our logic hangs off this scroll — so just scoping the work out felt heavy. On top of that, after trying various things, the 2+3 combo above already caught most of the not-reaching-bottom cases, and the ROI on the remaining symptoms looked small, so I didn't actually adopt this. But if this part ever needs a full rewrite down the line, I'd go straight for #4.

## An Alternative: Switching to TanStack Virtual

The reason I pulled TanStack Virtual back out right after adopting it was that it didn't have chat features built in. I'd have had to write bottom-following, position correction on prepending old history, and everything else from scratch on top of TanStack — and at that point, just cutting the list to the last 100 messages and hand-rolling windowing seemed a lot faster.

But while researching for this post, I found that TanStack Virtual added `anchorTo: 'end'` back in May 2026. It looks like it's similar to virtuoso's `followOutput`, but it calculates bottom alignment from the DOM's actual max scroll value instead of the sum of measured heights, and while the scroll is pinned to the bottom, if the list height grows, it follows down by that amount. That sidesteps the whole "you need to scroll to measure height, but the height keeps changing" problem that was at the root of symptom `A`. It's basically the library taking over the logic I hand-wrote in #3. And since items are positioned absolutely, there's no normal-flow pushing either, and it keeps prepend position stable based on message key.

In a quick test, `A` never showed up under any condition, but `B` still caused scroll jumps if there were messages whose height changed on re-render mixed in. So if I were to adopt TanStack, I'd still need #1 (nailing down height ahead of time) as a separate piece of work.

As I mentioned, the chat screen is the most important one in our product, and it has every feature under the sun bolted onto it, so the chat component runs to about 1500 lines (and that's after a round of refactoring already). So there's a real switching cost, and our e2e tests are tied to virtuoso too. Honestly, if switching to TanStack solved every problem, it'd be worth the cost. But since `anchorTo: 'end'` is still a new feature, I think it's worth waiting and watching a bit longer.

And looking at TanStack Virtual's own issue tracker, they're still fixing the same category of bugs I fought all summer. Things like the browser clamping `scrollTop` because it gets set before the full height is reflected, the screen getting pushed around as a streaming message grows, or a gap opening up at the top after a prepend.

### Comparison Table

| Approach | A (falls short of bottom) | B (jitter) | Cost / limits |
|---|---|---|---|
| 1. Nail down height ahead of time | Mitigated | Mitigated | Content constraints. Limited for streaming |
| 2. Prevent unmounting near bottom | - | Solved | No virtualization benefit near bottom / requires a row-height assumption |
| 3. Re-stick on size change | Not viable alone | - | Custom code to write |
| 2 + 3 | Solved | Solved | Same limits as 2+3 |
| 4. Non-virtual bottom only | Solved | Solved | Refactor for boundary handling |
| 5. Message List | Needs checking | Solved | Commercial license |
| 6. Switch to TanStack | Solved | Partially solved | Headless, so UI has to be built by hand / new feature, adoption risk |

If you can control item height, #1 might be all you need. Removing margins and preventing duplicate animation playback alone can cut the symptoms down quite a bit. If you can't pin down the height, the 2+3 combo works.

If your history is long or smooth scroll quality really matters, it's worth weighing code cost against license cost and going with either #4 or #5.

And if you're considering a new virtualization library from scratch, [comparing virtuoso against TanStack](https://npmtrends.com/@tanstack/react-virtual-vs-react-virtuoso-vs-react-window) might be worth a look.

## What I Learned

Right now our product runs on 1+2+3. Entrance animations play once per message id, `followOutput` is off, and I pin to the bottom myself whenever an item's size changes. `increaseViewportBy.top` is set huge enough that virtualization near the bottom is effectively off. I turned off virtualization to fix virtual scrolling.

It took half a year to go from the clumsy TanStack adoption in August 2025, through hand-rolled windowing, to adopting virtuoso in February 2026 — and then close to another half year wrestling with the problems virtuoso couldn't solve. (Though, to be fair, other urgent work kept pulling me away from it in between.) The screen has so many features attached that a full rewrite meant touching a lot of code, and tearing up the structure came with no guarantee against regressions either, which made it even harder. And doing optimization and bug fixes at all while requirements kept changing and piling up was never easy.

Would picking virtuoso from the start have saved me some trial and error? Looking back, I don't think so. Any library built around normal-flow layout would have hit the same wall eventually. What I regret is that when picking a library, I only looked at the feature list. I didn't realize at the time that having `followOutput` and actually sticking to the bottom the way my screen needed were two different things. Next time I bring in a virtualization library, I think I'll look at how it positions items before I look at what options it has.
