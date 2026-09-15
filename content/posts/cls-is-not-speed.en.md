+++
date = '2026-07-29T19:41:48+09:00'
draft = false
title = 'I Cut CLS by 78%, So Why Was It Still Slow?'
description = "I cut cold-load CLS by 78% from 0.385, but it felt just as slow. Notes on why a better score isn't the same as a faster site."
tags = ["Performance"]
+++

When you're trying to improve a web service's performance, you usually start by running Lighthouse. The score comes back, something's red, and now you have to knock those out one by one. But it turns out improving a metric and actually feeling faster are kind of different things. I once cut a metric by 78% and still got a report that the site felt slow.

## CLS Is a Metric for "Unreserved Space"

The platform's main screen is the one people hit most often, so it needs to feel snappy — but its cold-load CLS was 0.385. The Good threshold is usually under 0.1, so the screen was failing to settle at nearly four times that. Looking into the cause, I found that the game list was painted near the top of the screen on first paint, then the moment user data arrived, the profile block filled in and grew, pushing the entire list down.

![The Lighthouse report I measured at the time. Performance 47, CLS 0.385](/images/posts/cls-is-not-speed/lighthouse-cls-0385.webp)

```tsx
// conditional render doesn't reserve space
{user && <PlatformUserInfo user={user} />}   // profile section isn't shown until user data arrives
<GamesWithFilter />                           // so the list starts at the top and then gets pushed down

// height depends on the parent
<Avatar className="h-full" />   // 0 until the flex parent's height is determined
```

"Don't render when there's no data" and "h-full that depends on the parent" are both common patterns. But from the browser's perspective, neither tells it ahead of time what's going to occupy that space, and that's exactly what caused the problem.

> The mechanism behind layout shift is simple. On every render, the browser finalizes the layout with whatever information it currently has and paints it. When data or images arrive later and change the size of an element above something already painted, the starting coordinates of everything below it all move. CLS is the accumulation of that movement and the area it affects. So to improve CLS, all you really need to do is tell the browser ahead of time.

```tsx
// reserve space even without data
{
  user ? (
    <PlatformUserInfo user={user} />
  ) : (
    <div className="min-h-80">
      <Loading />
    </div>
  );
}

// change height from parent-dependent to a fixed value
<Avatar className="h-30" />;
```

Since I reserved an arbitrary height rather than the exact content height, a small shift still remained. But it met the Good threshold of under 0.1, so I judged the goal satisfied and stopped there.

I'd taken something that was close to 0.4 down to 0.1 — surely that counts as a meaningful speedup, right? But no. Even after cutting CLS by 78% and turning every metric Good, the reports that the service wasn't "snappy" kept coming. People said it was especially slow on the first visit.

## Reducing the Metric Didn't Actually Make It Faster

The reason was that CLS isn't a speed metric. Just shrinking the number Lighthouse shows you doesn't make the site faster. The actual speed metric is LCP — when the largest piece of content becomes visible. CLS, if anything, is a metric that helps you be reliably slow, by adding skeleton UI and the like.

Wanting to shave off even a little more of the initial load, I'd also done some code splitting, so I took a network capture of the landing page's first load to measure the after. JS went from 1032KB before splitting down to a 674KB initial load — a 35% cut. But looking at the capture, I noticed the first load was also pulling in about 4MB of PNG onboarding images. I'd worked hard to shrink the JS bundle, and meanwhile images for an onboarding section in a carousel UI — a section the user hadn't even scrolled to yet — were being loaded on the very first screen.

No wonder none of the metrics caught it. The image space was already reserved, so CLS would have been 0. It wasn't the largest element in the first viewport, so it didn't touch LCP either. It wasn't JS, so it never showed up in the bundle analysis. Every metric was Good, and yet 4MB was being sent on every first visit. That's why the slow reports kept coming specifically on first visits.

After that I switched the images to webp and applied lazy loading. Measuring the network again, I got the size down from 3.7MB to 466KB — an 87% reduction. (As an unexpected bonus, it also shrank the asset size in the APK build.)

![Network requests for the onboarding images after switching to webp. img-onBoard-1, 2, 3.webp are each down to around 60-80KB](/images/posts/cls-is-not-speed/network-onboard-webp.webp)

```tsx
<img
  src={`/image/${img}`} // switched to webp
  alt={img}
  loading={index === 0 ? "eager" : "lazy"} // load the first image eagerly, lazy-load the rest
  fetchPriority={index === 0 ? "high" : undefined}
  decoding="async"
/>
```

## What I Learned

CLS measures stability, LCP measures speed, and bundle size only measures JS weight. Before fixing a metric, I should have checked what it actually covers. I also learned not to feel safe just because every Lighthouse metric is green — when something feels slow, you need to check the network transfer list too.

## References

- [web.dev — Cumulative Layout Shift](https://web.dev/articles/cls)
- [web.dev — Optimize CLS](https://web.dev/articles/optimize-cls)
- [web.dev — Largest Contentful Paint](https://web.dev/articles/lcp)
- [MDN — `loading="lazy"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#loading)
