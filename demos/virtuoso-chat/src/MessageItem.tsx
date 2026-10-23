import { useEffect, useState } from 'react';

import type { Message } from './messages';
import { useMountRegistry } from './mountRegistry';
import { t } from './text';

type Props = {
    message: Message;
    fixedHeight: boolean;
};

const CHOICES_DELAY_MS = 500;

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const useDelayedFlag = (delayMs: number) => {
    const [on, setOn] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setOn(true), delayMs);
        return () => window.clearTimeout(timer);
    }, [delayMs]);
    return on;
};

const LateImage = (props: { id: string; fixedHeight: boolean }) => {
    const { loadedImageIds } = useMountRegistry();
    const [delayMs] = useState(() => (loadedImageIds.has(props.id) ? randomBetween(40, 120) : randomBetween(300, 900)));
    const loaded = useDelayedFlag(delayMs);

    useEffect(() => {
        if (loaded) loadedImageIds.add(props.id);
    }, [loaded, props.id, loadedImageIds]);

    const className = props.fixedHeight ? 'image image-reserved' : loaded ? 'image image-loaded' : 'image image-pending';
    return (
        <div className={className} data-loaded={loaded}>
            {loaded ? null : <span className="image-loading">{t.imageLoading}</span>}
        </div>
    );
};

const Choices = (props: { choices: string[]; fixedHeight: boolean }) => {
    const shown = useDelayedFlag(CHOICES_DELAY_MS);
    if (!shown && !props.fixedHeight) return null;
    return (
        <div className={shown ? 'choices' : 'choices choices-hidden'}>
            {props.choices.map((choice) => (
                <button key={choice} type="button" tabIndex={shown ? 0 : -1}>
                    {choice}
                </button>
            ))}
        </div>
    );
};

export const MessageItem = ({ message, fixedHeight }: Props) => {
    const { playedEntryIds } = useMountRegistry();
    const [entryClass] = useState(() => {
        if (!fixedHeight) return 'enter-grow';
        return playedEntryIds.has(message.id) ? '' : 'enter-fade';
    });

    useEffect(() => {
        if (fixedHeight) playedEntryIds.add(message.id);
    }, [fixedHeight, message.id, playedEntryIds]);

    return (
        <div className={message.mine ? 'row row-mine' : 'row'} data-msg-row="" data-msg-id={message.id} data-msg-kind={message.kind}>
            <div className={entryClass}>
                <div className="bubble">
                    {message.kind === 'image' ? (
                        <LateImage id={message.id} fixedHeight={fixedHeight} />
                    ) : null}
                    {message.text || message.streaming ? (
                        <p className="text">
                            {message.text}
                            {message.streaming ? <span className="caret" aria-hidden="true" /> : null}
                        </p>
                    ) : null}
                    {message.kind === 'choices' ? <Choices choices={message.choices} fixedHeight={fixedHeight} /> : null}
                </div>
            </div>
        </div>
    );
};
