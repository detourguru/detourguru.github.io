+++
date = '2026-07-10T00:14:11+09:00'
draft = false
title = 'Lock at the Entry Point to Stop Duplicate Runs'
description = "A duplicate SSE connection, a re-entrant SQLite batch insert, and a double-clicked chat message all came from the same race condition: an await sitting between checking state and changing it. Taking a lock with a ref or flag at function entry, before the await, fixed all three."
tags = ["Debugging", "React"]
+++

The hardest bugs I've had to deal with are the ones that happen intermittently. They're hard to reproduce, the code looks fine on the surface, so tracking down the actual cause takes a while.

The race condition bugs in this post were exactly like that. There was an SSE connection that fired twice _intermittently_, a SQLite batch insert that ran twice _intermittently_, and a chat message that got sent twice _intermittently_. At first I thought these were three completely unrelated problems — they were even reported at different times. So I fixed each one separately, and it wasn't until I fixed the third one that I realized all three were actually the same pattern.

> If there's an asynchronous operation between a check and a state change, you've got a race condition waiting to happen.

## First: Duplicate SSE Connections

The first one I ran into was while working on the SSE connection.

```ts
function useSSE() {
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (eventSourceRef.current) return; // return if already connected

    fetchAuthToken().then((token) => {
      eventSourceRef.current = new EventSource(`/sse?token=${token}`);
    });
  }, []);
}
```

As you can see from the code, it returns early if a connection already exists, so duplicate connections shouldn't have been possible. But in practice they happened anyway. What was going on?

I checked it (by dropping a console.log into every branch) and the actual flow looked like this.

1. On the first connection, check `eventSourceRef`
2. It's null, so it passes
3. `fetchAuthToken` runs
4. The `EventSource` hasn't been created yet
5. The same effect runs again (this was because of React StrictMode)
6. Since the source hasn't been created, `eventSourceRef` is still null
7. It passes again

The problem wasn't the check itself. It was that there was an **asynchronous operation** wedged between the check and the state change. Once I knew why it was running twice, the fix wasn't hard. I flipped the state before the asynchronous operation, so no other run could slip in.

```ts
const connectingRef = useRef(false);

useEffect(() => {
  if (connectingRef.current) return;

  connectingRef.current = true; // flip the state right here

  fetchAuthToken()
    .then((token) => {
      eventSourceRef.current = new EventSource(`/sse?token=${token}`);
      connectingRef.current = false; // release the lock
    })
    .catch(() => {
      connectingRef.current = false; // release the lock on error too
    });
}, []);
```

## Second: SQLite Batch Re-entrancy

The next one I ran into was in code that batches up multiple insert requests and processes them together.

```ts
async flushPendingInserts() {
  const pending = this.pendingInserts;

  this.pendingInserts.clear();

  await db.execute('BEGIN TRANSACTION');

  await db.executeSet(pending);

  await db.execute('COMMIT');
}
```

In a Capacitor app, batch-inserting chat history into SQLite kept throwing errors because of transaction conflicts.

Turned out the second flush would start while the first flush's transaction was still running, so the same work ended up executing concurrently — there was no branch checking whether a flush was already in progress.

```ts
async flushPendingInserts() {
  if (this.isFlushing) return;

  this.isFlushing = true;

  try {
    // batch processing
  } finally {
    this.isFlushing = false;
  }
}
```

Switching to grabbing a lock right away like this fixed it.

## Third: Duplicate Chat Message Sends

This one was a QA fail: "if the user clicks the send button twice quickly, the same message gets sent twice."

```ts
async function handleSend() {
  if (input.trim() === "") return;

  const text = input;

  setInput("");

  await sendChatMessage(text);
}
```

Looking at the code, it calls `setInput('')` right away, so it looked like there shouldn't be a problem. But messages were still getting sent twice.

State referenced within the same render behaves like a snapshot — it can't change mid-render. So even though the first click calls `setInput('')`, the handler that's currently running, and the event flow that's already been created, keep using the old `input` value. Which meant a second click could end up running with the same value too.

```ts
// first click
input = "hello";

setInput("");
sendChatMessage(text); // "hello"
```

The problem was that if a second click came in before the `setInput` change took effect, `input` could still be "hello".

```ts
sendChatMessage("hello");
sendChatMessage("hello");
```

I fixed it by putting a synchronous lock on a ref.

```ts
const sendingRef = useRef(false);

async function handleSend() {
  if (sendingRef.current) return; // return if it's still running
  if (!input.trim()) return;

  sendingRef.current = true; // lock it

  try {
    const text = input;

    setInput("");

    await sendChatMessage(text);
  } finally {
    sendingRef.current = false; // unlock it
  }
}
```

`useState` only takes effect on the next render, but `ref.current` changes immediately, so this approach worked right away.

## Completely Different Domains, Same Pattern

Looking back at all three cases, the structure is identical: `check if already processing > async operation > mark as done`.

I'd been assuming JS is safe because it's single-threaded, but the moment you hit an `await`, the same function can get called again in that gap. It's a kind of `concurrency`, in a sense.

So when an asynchronous call sits between the state check and the state change, the second call's check can run before the first call's state change lands — and both calls end up passing the check.

Similar to how you'd solve thread concurrency issues, I put the state check and the lock right next to each other synchronously, closing off any gap for async code to slip in — which ends up looking a lot like a mutex from multi-threaded programming.

> mutex: a synchronization technique that prevents multiple threads or processes from accessing one shared resource at the same time (so basically, a lock)

```ts
if (processing) return;

processing = true; // lock synchronously before the async logic

try {
  await something();
} finally {
  processing = false; // unlock once everything's done
}
```

## What I Learned

At first I thought all three problems had different causes.

I figured the SSE one was a React lifecycle issue, the SQLite one was a transaction issue, and the chat one was a user input issue.

But the core issue turned out to be the same across all three: after an async operation starts, before the state changes, another execution can slip in.

After going through all three, now whenever I write an async function I ask myself first: "is it okay if this function runs twice?" If it's not — if duplicate runs would break something — the lock needs to go at the entry point of the function, not somewhere after the `await`.
