import { useCallback, useEffect, useRef } from 'react';

import { distanceToBottom } from '../metrics';

const USER_INPUT_WINDOW_MS = 300;
const USER_INPUT_EVENTS = ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'] as const;

export const useStickToBottom = (scroller: HTMLElement | null, enabled: boolean) => {
    const pinnedRef = useRef(true);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!scroller || !enabled) return;

        let lastScrollTop = scroller.scrollTop;
        let lastUserInputAt = -Infinity;
        const markUserInput = () => {
            lastUserInputAt = performance.now();
        };
        const handleScroll = () => {
            const scrollTop = scroller.scrollTop;
            const scrolledUp = scrollTop < lastScrollTop;
            lastScrollTop = scrollTop;
            if (distanceToBottom(scroller) <= 1) pinnedRef.current = true;
            else if (scrolledUp && performance.now() - lastUserInputAt < USER_INPUT_WINDOW_MS) pinnedRef.current = false;
        };

        for (const type of USER_INPUT_EVENTS) scroller.addEventListener(type, markUserInput, { passive: true });
        scroller.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            for (const type of USER_INPUT_EVENTS) scroller.removeEventListener(type, markUserInput);
            scroller.removeEventListener('scroll', handleScroll);
        };
    }, [scroller, enabled]);

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    return useCallback(() => {
        if (!scroller || !enabled || !pinnedRef.current) return;
        // 콜백 시점엔 새 높이가 DOM에 반영되기 전일 수 있어 다음 프레임에 보낸다
        cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(() => {
            if (pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
        });
    }, [scroller, enabled]);
};
