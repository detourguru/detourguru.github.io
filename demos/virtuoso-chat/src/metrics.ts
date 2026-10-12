import { useCallback, useEffect, useRef, useState } from 'react';

import { describeMissCause, describeShakeCause, watchRows } from './rowWatch';

export const AT_BOTTOM_PX = 2;
const USER_INPUT_WINDOW_MS = 300;
const CONTENT_SETTLE_MS = 1000;
const MISS_CHECK_DELAY_MS = 1000;
const MISS_CONFIRM_MS = 150;
const PUBLISH_INTERVAL_MS = 100;
const SHAKE_CAUSE_LOOKBACK_MS = 1500;
const MOUNT_SETTLE_MS = 2500;
const SHAKE_REPORT_PX = 4;

export type MetricsSnapshot = {
    distance: number;
    missCount: number;
    idleShiftSum: number;
};

export type MetricsEvent = { kind: 'miss' | 'shake' | 'roundTrip'; px: number; cause?: string };

const EMPTY: MetricsSnapshot = { distance: 0, missCount: 0, idleShiftSum: 0 };

type PendingCheck = { appendedAt: number; dueAt: number; confirming: boolean };

type Counters = {
    missCount: number;
    idleShiftSum: number;
    lastContentAt: number;
    lastUserInputAt: number;
    userLeftBottom: boolean;
    pendingChecks: PendingCheck[];
};

const createCounters = (): Counters => ({
    missCount: 0,
    idleShiftSum: 0,
    lastContentAt: -Infinity,
    lastUserInputAt: -Infinity,
    userLeftBottom: false,
    pendingChecks: [],
});

const USER_INPUT_EVENTS = ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'] as const;

export const distanceToBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight;

const findCenterMessage = (scroller: HTMLElement) => {
    const rect = scroller.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const row = hit?.closest<HTMLElement>('[data-msg-id]');
    return row && scroller.contains(row) ? row : null;
};

export const useLiveMetrics = (scroller: HTMLElement | null, onEvent: (event: MetricsEvent) => void) => {
    const [snapshot, setSnapshot] = useState<MetricsSnapshot>(EMPTY);
    const countersRef = useRef<Counters>(createCounters());
    const latestRef = useRef<MetricsSnapshot>(EMPTY);

    useEffect(() => {
        if (!scroller) return;

        const markUserInput = () => {
            countersRef.current.lastUserInputAt = performance.now();
        };
        for (const type of USER_INPUT_EVENTS) scroller.addEventListener(type, markUserInput, { passive: true });

        let lastScrollTop = scroller.scrollTop;
        let anchor: { id: string; top: number } | null = null;
        const rows = watchRows(scroller);
        let shakeEpisode = 0;
        let shakeStartedAt = 0;
        let farthestAway = 0;
        let lastPublishAt = 0;
        let frame = 0;
        
        const quietUntil = performance.now() + MOUNT_SETTLE_MS;

        const tick = (now: number) => {
            const counters = countersRef.current;
            const distance = distanceToBottom(scroller);
            const scrollTop = scroller.scrollTop;
            const scrolledUp = scrollTop < lastScrollTop;
            lastScrollTop = scrollTop;

            const userActive = now - counters.lastUserInputAt < USER_INPUT_WINDOW_MS;
            if (distance <= AT_BOTTOM_PX) {
                if (counters.userLeftBottom) onEvent({ kind: 'roundTrip', px: Math.round(farthestAway) });
                counters.userLeftBottom = false;
                farthestAway = 0;
            } else {
                if (userActive && scrolledUp) counters.userLeftBottom = true;
                if (counters.userLeftBottom) farthestAway = Math.max(farthestAway, distance);
            }

            const idle = !userActive && now > quietUntil && now - counters.lastContentAt > CONTENT_SETTLE_MS;
            let shift = 0;
            if (anchor && idle) {
                const prev = scroller.querySelector(`[data-msg-id="${CSS.escape(anchor.id)}"]`);
                shift = prev ? Math.abs(prev.getBoundingClientRect().top - anchor.top) : 0;
            }
            if (shift > 0.5) {
                counters.idleShiftSum += shift;
                if (shakeEpisode === 0) shakeStartedAt = now;
                shakeEpisode += shift;
            } else if (shakeEpisode > 0) {
                if (shakeEpisode >= SHAKE_REPORT_PX) {
                    const since = shakeStartedAt - SHAKE_CAUSE_LOOKBACK_MS;
                    const change = rows.biggestChangeSince(since, true) ?? rows.biggestChangeSince(since, false);
                    onEvent({ kind: 'shake', px: Math.round(shakeEpisode), cause: describeShakeCause(change) });
                }
                shakeEpisode = 0;
            }
            const center = findCenterMessage(scroller);
            anchor = center?.dataset.msgId ? { id: center.dataset.msgId, top: center.getBoundingClientRect().top } : null;

            const stillPending: PendingCheck[] = [];
            for (const check of counters.pendingChecks) {
                if (counters.lastUserInputAt >= check.appendedAt) continue;
                if (check.dueAt > now) {
                    if (!(check.confirming && distance <= AT_BOTTOM_PX)) stillPending.push(check);
                    continue;
                }
                if (distance <= AT_BOTTOM_PX) continue;
                if (check.confirming) {
                    counters.missCount += 1;
                    onEvent({
                        kind: 'miss',
                        px: Math.round(distance),
                        cause: describeMissCause(rows.biggestChangeSince(check.appendedAt, false)),
                    });
                } else {
                    stillPending.push({ ...check, dueAt: now + MISS_CONFIRM_MS, confirming: true });
                }
            }
            counters.pendingChecks = stillPending;

            if (now - lastPublishAt >= PUBLISH_INTERVAL_MS) {
                lastPublishAt = now;
                const next: MetricsSnapshot = {
                    distance: Math.round(distance),
                    missCount: counters.missCount,
                    idleShiftSum: Math.round(counters.idleShiftSum),
                };
                latestRef.current = next;
                setSnapshot(next);
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frame);
            rows.disconnect();
            for (const type of USER_INPUT_EVENTS) scroller.removeEventListener(type, markUserInput);
        };
    }, [scroller, onEvent]);

    const noteAppend = useCallback(() => {
        const counters = countersRef.current;
        const now = performance.now();
        counters.lastContentAt = now;
        if (!counters.userLeftBottom) counters.pendingChecks.push({ appendedAt: now, dueAt: now + MISS_CHECK_DELAY_MS, confirming: false });
    }, []);

    const noteContentChange = useCallback(() => {
        countersRef.current.lastContentAt = performance.now();
    }, []);

    const reset = useCallback(() => {
        countersRef.current = createCounters();
    }, []);

    const markAtBottom = useCallback(() => {
        countersRef.current.userLeftBottom = false;
    }, []);

    const getSnapshot = useCallback(() => latestRef.current, []);

    return { snapshot, noteAppend, noteContentChange, reset, markAtBottom, getSnapshot };
};
