# Chat bottom pinning demo

[한국어](README.md)

A demo that reproduces two problems in a react-virtuoso chat: new messages not sticking to the bottom, and the list jittering while nobody is scrolling. You can switch between before and after the fix.

- Post: [I Turned Off Virtualization to Fix Virtual Scrolling](https://detourguru.github.io/en/posts/virtuoso-chat-bottom/)
- Demo: https://detourguru.github.io/demos/virtuoso-chat/?lang=en

## What it reproduces

The first problem is missing the bottom. `followOutput` finishes its scroll using an estimated height for messages that haven't been measured yet. When an image loads late or choice buttons are attached late, the message grows after the scroll has finished, and the list stops that far short of the bottom.

The second problem is jitter. When a message that left the screen is drawn again, virtuoso measures its height again. In this demo the entry animation changes the height and replays from the start every time the message is drawn again, so the new measurement differs from the remembered height and the list moves while sitting still.

## How it's fixed

"After fix" turns on workarounds 1, 2 and 3 from the post together. The switch on screen toggles `fixed` in `VirtuosoList` and `fixedHeight` in `MessageItem`.

| | Before fix | After fix |
| --- | --- | --- |
| 1. Fix heights up front (`MessageItem.tsx`) | An image grows from a one-line loading label to 200px, and choices are attached after 500ms. The entry animation `enter-grow` changes the height and replays on every mount | Space for images and choices is reserved from the start. The entry animation `enter-fade` uses only `transform` and `opacity`, and plays once per message id |
| 2. Keep rows near the bottom mounted (`VirtuosoList.tsx`) | `increaseViewportBy` 0, all messages | `increaseViewportBy={{ top: 12000, bottom: 1200 }}`, only the latest 30 |
| 3. Pin to the bottom by hand (`useStickToBottom.ts`) | `followOutput="auto"` | `followOutput` is off. When `totalListHeightChanged` fires, the list scrolls to the real `scrollHeight` on the next frame |

The animation-played records and image-loaded records live in `mountRegistry.ts`, because component state is lost when virtualization unmounts a row.

Workaround 2 only holds while the message count times the max row height stays below `increaseViewportBy.top`. 30 messages at 320px is 9600px, and top is 12000px. If this breaks, rows near the bottom get unmounted again, so the module throws an error on import.

For workaround 3, releasing the pin based on distance to the bottom alone can misjudge the list as not at the bottom while messages pile up quickly. So the pin is released only when there was wheel, touch, key or pointer input in the last 300ms, which counts as the user scrolling up. It pins again when the list comes back within 1px of the bottom.

## How the problems are detected

`metrics.ts` measures every frame, and the numbers on screen update every 100ms.

For missing the bottom, within 2px of the bottom counts as the bottom. When a message is added while the user hasn't left the bottom, it checks 1 second later, and if the list still isn't at the bottom it watches for another 150ms. To avoid counting cases that catch up a frame or two late, it counts one miss only if the list never touches the bottom during those 150ms.

Jitter is the sum of how far the message in the middle of the scroll area moved since the last frame. Movement right after user input or while a message is growing isn't jitter, so frames within 300ms of input or within 1 second of an append are excluded. Consecutive moving frames are grouped into one, and it reports only when the sum is 4px or more.

`rowWatch.ts` writes the cause line. It records each row's height changes and remounts for 4 seconds, and when a problem is detected it names the row whose height changed the most in that window. For example, if the `Sent a photo` message went from 16px to 258px when it was drawn again, that message is named. It picks the row that changed the most, so it doesn't prove the cause.

"Run automatically" (`useScenario.ts`) sends 5 late-growing messages 1.3 seconds apart, sends 10 at once 50ms apart, scrolls up and back down, and watches for 2.5 seconds.

The walkthrough (`useTutorial.ts`) moves to the next step only when something is actually detected. The last step ends after 6 or more sends and at least one scroll up and down in "After fix", followed by 1.5 seconds with nothing detected. It waits that long because the miss check finishes 1 second after an append.

## Files

| File | Role |
| --- | --- |
| `src/App.tsx` | Screen, switch, send button, "Run automatically" and the walkthrough |
| `src/lists/VirtuosoList.tsx` | Virtuoso setup. Turns on workarounds 2 and 3 based on `fixed` |
| `src/lists/useStickToBottom.ts` | Hook that scrolls to the real end when the list size changes, instead of `followOutput` |
| `src/MessageItem.tsx` | Message row. Late-growing images and choices, entry animation |
| `src/mountRegistry.ts` | Animation-played and image-loaded records that must survive remounts |
| `src/messages.ts` | Message kinds, 60 initial messages with a fixed seed, message text per language |
| `src/text.ts` | Screen text. Uses English when the URL has `?lang=en` |
| `src/useMessageFeed.ts` | Adding messages, streaming, bursts |
| `src/metrics.ts` | Detects missing the bottom and jitter |
| `src/rowWatch.ts` | Per-row height changes and remounts, cause lines |
| `src/useScenario.ts` | "Run automatically" |
| `src/useTutorial.ts` | Walkthrough steps and guide text |
| `src/useFlashLines.ts` | Alerts that show briefly when something is detected |
| `src/styles.css` | Row spacing uses padding, because virtuoso can't measure margins |

## Notes

Image loading is simulated with timers. The first load takes 300ms to 900ms and a redraw takes 40ms to 120ms, both random, so the miss count and jitter size vary a little between runs. The 60 initial messages use a fixed seed and are the same every time.

Jitter is measured by the position of one message in the middle of the screen. "After fix" keeps only the latest 30 messages, which works because this demo doesn't load older history upward. StrictMode isn't used because its double mount in development mixes into the remount measurements.

The English post's shortcode adds `?lang=en` to the demo URL. With the same seed, English has the same message kinds and order as Korean, but the sentences are a different length, so row heights and measurements can differ from Korean.

Workaround 4 from the post (only the bottom non-virtualized), Virtuoso Message List, and switching to TanStack Virtual are not in this demo.

Code comments are in Korean.
