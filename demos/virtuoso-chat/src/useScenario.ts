import { useCallback, useEffect, useRef, useState } from 'react';

import type { MessageKind } from './messages';
import type { MetricsSnapshot } from './metrics';

export type ScenarioActions = {
    restart: () => void;
    alignToBottom: () => void;
    resetMeasurements: () => void;
    add: (kind: MessageKind) => void;
    burst: () => void;
    wheel: (deltaY: number) => void;
    read: () => MetricsSnapshot;
};

export type ScenarioResult = { miss: number; shift: number };

const LATE_MESSAGES: readonly MessageKind[] = ['image', 'choices', 'image', 'stream', 'image'];

const sleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(signal.reason);
        const timer = window.setTimeout(resolve, ms);
        signal.addEventListener(
            'abort',
            () => {
                window.clearTimeout(timer);
                reject(signal.reason);
            },
            { once: true },
        );
    });

export const useScenario = () => {
    const [phase, setPhase] = useState<string | null>(null);
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const stop = useCallback(() => controllerRef.current?.abort(), []);

    const run = useCallback(async (actions: ScenarioActions): Promise<ScenarioResult | null> => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        const { signal } = controller;

        try {
            setPhase('준비 중');
            actions.restart();
            await sleep(2500, signal);
            actions.alignToBottom();
            await sleep(400, signal);
            actions.resetMeasurements();

            for (const [i, kind] of LATE_MESSAGES.entries()) {
                setPhase(`메시지 보내는 중 ${i + 1}/${LATE_MESSAGES.length}`);
                actions.add(kind);
                await sleep(1300, signal);
            }
            setPhase('10개 한꺼번에');
            actions.burst();
            await sleep(3000, signal);

            setPhase('위로 올렸다가');
            for (let i = 0; i < 6; i += 1) {
                actions.wheel(-250);
                await sleep(120, signal);
            }
            await sleep(1200, signal);
            setPhase('다시 내리는 중');
            for (let i = 0; i < 12; i += 1) {
                actions.wheel(250);
                await sleep(120, signal);
            }
            setPhase('지켜보는 중');
            await sleep(2500, signal);

            const snapshot = actions.read();
            return { miss: snapshot.missCount, shift: snapshot.idleShiftSum };
        } catch (error) {
            if (signal.aborted) return null;
            throw error;
        } finally {
            if (controllerRef.current === controller) {
                controllerRef.current = null;
                setPhase(null);
            }
        }
    }, []);

    return { phase, running: phase !== null, run, stop };
};
