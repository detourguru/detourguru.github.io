+++
date = '2026-07-16T23:32:36+09:00'
draft = false
title = 'The Production Server Was Running on npm run dev'
description = "First visits from overseas sat on the splash screen for 6 seconds because pm2 was running the production server with npm run dev, the Vite dev server. Fetching 249 unbundled modules one round trip at a time only hurt on high-RTT networks. After instrumenting it with Sentry, serving the real build brought it down to 128ms."
tags = ["Performance", "Debugging"]
+++

This happened during an internal test round. Two performance reports had come in.

> Saving and loading in the editor is slow.

Honestly, this was a known issue already. I figured it was just slow because the data was large, but I checked around for more optimization opportunities anyway and found a global invalidate sitting there. So I switched it to a targeted invalidate and parallelized the Suspense waterfall with prefetching. There was also some unnecessary computation in the node tree code, so I cleaned that up too. It was still a bit slow, but I managed to bring save time down from around 4 seconds to around 2.

> When I connect from overseas, the splash screen just sits there for a long time, like it's frozen.

This one I hadn't seen before. I couldn't exactly fly overseas myself, so I connected through a VPN to approximate the environment and tested it — and it really was slow! Slow enough that I wondered if it had errored out and just wasn't rendering at all. But the odd part was that it was only brutally slow on the first load. Once the screen came up once, it was fast after that.

Being fast after the first load didn't look like a code problem, and looking at the network packets, it clearly wasn't a server problem either. So what was it, then? If not code, maybe the environment?

I'd run into cases before where preview gave different results than local dev, so I spun it up with `npm run preview` and tested again... and it was fast! So I went into the server and checked what command was actually serving it. The result was startling.

```
$ pm2 show public_server
│ script path │ /usr/bin/npm │
│ script args │ run dev      │ // here!
│ uptime      │ 24D          │
```

User traffic was being served by Vite's **development server**.

## Just because it runs doesn't mean it's production-ready.

The root cause was that early in server setup, I'd just spun it up with dev mode without thinking much about it. There was no separate step for uploading build output, so changes went live fast, and for a service that wasn't even deployed yet, that was convenient and fit well enough at the time.

|                    | `npm run dev` (vite dev)       | `vite preview`                          | Real static server (nginx...) |
| ------------------ | ------------------------------- | ---------------------------------------- | ------------------------------ |
| What's served       | Raw source (native ESM, unbundled) | `dist/` build output                  | `dist/` build output           |
| Purpose             | Instant updates during local dev | Previewing the build output locally      | Handling real production traffic |
| Compression (gzip/brotli) | None                      | Not configured by default                | Yes (if configured)            |
| Dev-only channels   | HMR websocket etc. exposed      | Minimal                                  | None                           |
| Official stance     | Local use only                  | Explicitly says not to use as a production server | For production use      |

## Instrument first, fix later

It was obvious I needed to change how this was being served, but before touching anything, I shipped instrumentation code first — sending loading metrics to Sentry the moment the splash screen disappeared.

```ts
// sent right after the splash screen is removed
Sentry.captureMessage("first_load_timing", {
  level: "info",
  extra: {
    splashDurationMs: Math.round(performance.now()),
    ttfbMs: navEntry ? Math.round(navEntry.responseStart) : undefined,
    scriptCount: scriptEntries.length,
    scriptTransferSizeBytes: scriptEntries.reduce(
      (s, e) => s + (e.transferSize || 0),
      0,
    ),
  },
});
```

Partly I was curious how much this would actually improve once I changed the serving method, and partly — since it was our CEO who'd reported the issue — I wanted to report back with solid numbers instead of a vague impression.

### Here's the actual before/after

|                   | Before (dev serving)                                  | After (static serving) |
| ----------------- | ------------------------------------------------------ | ----------------------- |
| Splash duration    | **5,972ms** (first visit, cold) / 810ms (repeat visit, nearby) | **128ms**        |
| Script requests    | **249**                                                | **1**                    |
| Transfer size      | 167KB ~ **8.8MB** (uncompressed)                       | 612KB (gzip)             |
| TTFB               | 9ms                                                     | 6ms                       |

Before, on that first overseas test, the page took 6 seconds to load even though it only received 167KB. Afterward, it loaded in 0.8 seconds even while pulling down 8.8MB. So the long load time had nothing to do with how much data was being transferred!

While writing this post, I reran the same comparison on the current codebase.

![Network tab summary when opening the home screen through the dev server: 602 requests, 20.8 MB transferred, 20.8 MB resources](/images/posts/dev-server-as-production/network-summary-before.webp)
![Network tab summary when opening the same screen through preview after building: 23 requests, 1.1 MB transferred, 3.1 MB resources](/images/posts/dev-server-as-production/network-summary-after.webp)

*This is a fresh measurement, taken just now, of the same screen loaded locally under dev and under build+preview. The codebase has grown since the original report so the numbers differ from the original 249, but in terms of whether the request gets split into hundreds of pieces or bundled into one, the gap is still huge.*

## The round-trip count × RTT trap

The dev server doesn't bundle anything — it serves the source as individual modules, as-is. But the browser can only find out what a file imports after it opens that file, and only then does it request the next one. So bringing up a single screen meant asking for files one at a time, 249 times over. On top of that, HTTP/1.1 caps you at 6 concurrent connections, so those 249 requests couldn't all go out in parallel — they had to go back and forth sequentially. So... it was a problem that kept compounding on itself.

More importantly, this report came from someone testing overseas. The cost of a single round trip scales with distance — RTT. Internal testing happened on the same office network, so RTT was a few milliseconds, and even 249 sequential round trips only added up to a few hundred milliseconds total. That's why no speed-related reports ever came in internally — there was no way to tell it apart from normal.

Overseas, though, RTT was in the hundreds of milliseconds. Multiply that by 249 round trips and you're into seconds — in the worst case, tens of seconds. The number of round trips required was the same whether you were testing domestically or overseas, but the cost of each one wasn't. The editor, even after I'd sped it up by improving the internal logic, was still slow for exactly this same reason.

Here are the numbers from measuring dev and prod side by side, locally.

| Scenario (local comparison)                | dev   | prod build | Multiplier |
| -------------------------------------------- | ----- | ---------- | ---------- |
| Main thread blocking on editor entry         | 6.2s  | 1.78s      | ~3.5x      |
| Entity lookup click (after code improvements)| 1.65s | ~0.8s      | ~2x        |
| Re-render gap per Suspense step              | 420ms | 110ms      | ~4x        |

I'd been setting optimization priorities based on dev numbers the whole time, so I was basically digging in the wrong spot.

## Switching to an actual production setup

The first thing I did, obviously, was switch serving over to Preview. Internal testing was still ongoing at that point, so migrating to nginx stayed on the TODO list for later.

```bash
npm run build
pm2 delete public_server
pm2 start npm --name public_server -- run preview -- --port 3000 --host 0.0.0.0
pm2 save
```

Right after internal testing wrapped up, I switched the server config over to nginx and added caching on top. Of course, it got a lot faster still!

## What I learned

In my defense — if I'm allowed one — I'd never set up a server like this before, so maybe I can be forgiven a little for serving it in dev mode for convenience early on and then just... forgetting about it. Besides, it wasn't a deployed service yet, and testing mostly happened internally, so there'd been no real reason to touch this kind of optimization or configuration.

At first I spent a long time staring at the code, and there really were code issues, which I fixed. But the real problem, in the end, was that the production server was running on npm run dev. Going through this, I learned that a performance problem doesn't always mean the code is at fault.

Another thing that stuck with me was Sentry. We'd only just added it, and I put together some performance instrumentation with it — tracing through the logs to track down the cause turned out to be genuinely fun. And being able to compare before/after numbers meant I could tell whether something got faster or slower by coincidence, or because I'd actually fixed the root cause. Since then I've kept using Sentry to instrument things and track down causes through real measurements.
