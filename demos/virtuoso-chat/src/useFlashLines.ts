import { useCallback, useEffect, useRef, useState } from 'react';

export type FlashLine = { id: number; text: string; cause?: string };

const MAX_LINES = 2;

export const useFlashLines = (lifetimeMs: number) => {
    const [lines, setLines] = useState<FlashLine[]>([]);
    const nextIdRef = useRef(0);
    const timersRef = useRef(new Set<number>());

    const clear = useCallback(() => {
        const timers = timersRef.current;
        for (const id of timers) window.clearTimeout(id);
        timers.clear();
        setLines([]);
    }, []);

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            for (const id of timers) window.clearTimeout(id);
            timers.clear();
        };
    }, []);

    const push = useCallback(
        (text: string, cause?: string) => {
            nextIdRef.current += 1;
            const line = { id: nextIdRef.current, text, cause };
            setLines((prev) => [line, ...prev].slice(0, MAX_LINES));
            const timers = timersRef.current;
            const timer = window.setTimeout(() => {
                timers.delete(timer);
                setLines((prev) => prev.filter((l) => l.id !== line.id));
            }, lifetimeMs);
            timers.add(timer);
        },
        [lifetimeMs],
    );

    return { lines, push, clear };
};
