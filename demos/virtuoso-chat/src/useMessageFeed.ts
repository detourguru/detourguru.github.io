import { useCallback, useEffect, useRef, useState } from 'react';

import { createMessageFactory, createSeedMessages, pickRandomKind, STREAM_TOKENS, type Message, type MessageKind } from './messages';

type Options = {
    onAppend: () => void;
    onContentChange: () => void;
};

const STREAM_TOKEN_MS = 2000 / STREAM_TOKENS.length;
const BURST_COUNT = 10;
const BURST_INTERVAL_MS = 50;

export const useMessageFeed = ({ onAppend, onContentChange }: Options) => {
    const [messages, setMessages] = useState<Message[]>(createSeedMessages);
    const [factory] = useState(() => createMessageFactory(Math.random, 'live'));
    const timersRef = useRef(new Set<number>());

    const schedule = useCallback((fn: () => void, ms: number) => {
        const timers = timersRef.current;
        const id = window.setTimeout(() => {
            timers.delete(id);
            fn();
        }, ms);
        timers.add(id);
    }, []);

    const clearTimers = useCallback(() => {
        const timers = timersRef.current;
        for (const id of timers) window.clearTimeout(id);
        timers.clear();
    }, []);

    useEffect(() => () => clearTimers(), [clearTimers]);

    const streamInto = useCallback(
        (id: string, tokenIndex: number) => {
            const done = tokenIndex + 1 >= STREAM_TOKENS.length;
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === id ? { ...m, text: STREAM_TOKENS.slice(0, tokenIndex + 1).join(' '), streaming: !done } : m,
                ),
            );
            onContentChange();
            if (!done) schedule(() => streamInto(id, tokenIndex + 1), STREAM_TOKEN_MS);
        },
        [onContentChange, schedule],
    );

    const add = useCallback(
        (kind: MessageKind) => {
            const created = factory.create(kind);
            const message = kind === 'stream' ? { ...created, streaming: true } : created;
            onAppend();
            setMessages((prev) => [...prev, message]);
            if (kind === 'stream') schedule(() => streamInto(message.id, 0), STREAM_TOKEN_MS);
        },
        [factory, onAppend, schedule, streamInto],
    );

    const addRandom = useCallback(() => add(pickRandomKind(Math.random)), [add]);

    const burst = useCallback(() => {
        for (let i = 0; i < BURST_COUNT; i += 1) schedule(addRandom, i * BURST_INTERVAL_MS);
    }, [addRandom, schedule]);

    const reset = useCallback(() => {
        clearTimers();
        setMessages(createSeedMessages());
    }, [clearTimers]);

    return { messages, add, burst, reset };
};
