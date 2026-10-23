import { useEffect, useState } from 'react';

import { type AfterRow, type Mode, reconnect } from './catchup';
import { LAST_RECEIVED_ID, MESSAGES, type Message, RECEIVED_IDS } from './samples';
import { delayBefore, TIMELINE, type TimelineEvent } from './timeline';

const END = TIMELINE.length;

const anchor = MESSAGES.find((message) => message.id === LAST_RECEIVED_ID)!;
const short = (message: Message) => message.time.slice(-6); // 05.348

const PHONES: { mode: Mode; title: string }[] = [
    { mode: 'gt', title: '$gt로 묻기' },
    { mode: 'gte-filter', title: '$gte로 묻고 id로 거르기' },
];

const TAGS: Record<AfterRow['kind'], string> = { resent: '다시 받음', twice: '두 번 찍힘', missing: '빠짐' };

const STATUS = {
    idle: { text: '연결 전', className: 'is-idle' },
    connected: { text: '연결됨', className: 'is-on' },
    disconnected: { text: '끊김', className: 'is-off' },
    reconnecting: { text: '다시 연결 중', className: 'is-warn' },
} as const;

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// 인용한 메시지와 뒤에 붙는 조사가 줄바꿈으로 갈라지지 않게 묶는다
const Quote = ({ text, after }: { text: string; after: string }) => (
    <span className="nowrap">
        <span className="msg">{text}</span>
        {after}
    </span>
);

const Bubble = ({ message, kind, tag }: { message: Message; kind?: AfterRow['kind']; tag?: string }) => (
    <div className={`bubble${kind ? ` is-${kind}` : ''}`}>
        <span className="speaker">
            {message.speaker} <span className={message.savedAt === anchor.savedAt ? 'time is-same' : 'time'}>{short(message)}</span>
        </span>
        <span className="text">{message.text}</span>
        {tag && <span className="tag">{tag}</span>}
    </div>
);

const caption = (event: TimelineEvent | undefined) => {
    if (!event) return '소켓을 연결하는 중이다.';
    switch (event.kind) {
        case 'connect':
            return '소켓이 연결됐다. 두 화면은 같은 메시지를 받는다.';
        case 'live':
            return '서버가 보낸 메시지를 소켓으로 받아 채팅에 넣었다.';
        case 'cut':
            return (
                <>
                    앱이 백그라운드에 있다가 소켓이 끊겼다. 마지막으로 채팅에 넣은 메시지는 <Quote text={anchor.text} after="다." />
                    <span className="guide-detail">소켓이 끊긴 동안 온 메시지는 서버에 저장만 된다.</span>
                </>
            );
        case 'foreground':
            return (
                <>
                    앱으로 돌아와 다시 연결하면서 <Quote text={anchor.text} after="의" /> chatId를 보냈다.
                </>
            );
        case 'catchup':
            return '';
    }
};

const Phone = ({ mode, title, happened }: { mode: Mode; title: string; happened: TimelineEvent[] }) => {
    const has = (kind: TimelineEvent['kind']) => happened.some((event) => event.kind === kind);
    const status = has('catchup') ? 'connected' : has('foreground') ? 'reconnecting' : has('cut') ? 'disconnected' : has('connect') ? 'connected' : 'idle';
    const live = happened.flatMap((event) => (event.kind === 'live' ? [event.message] : []));
    const { rows, filtered } = reconnect(MESSAGES, RECEIVED_IDS, LAST_RECEIVED_ID, mode);

    return (
        <section className="phone" aria-label={`${title} 채팅 화면`}>
            <div className="phone-bar">
                <span className="phone-title">{title}</span>
                <span className={`status ${STATUS[status].className}`}>{STATUS[status].text}</span>
            </div>
            <div className="chat">
                {live.map((message) => (
                    <Bubble key={message.id} message={message} tag={has('foreground') && message.id === LAST_RECEIVED_ID ? '기준' : undefined} />
                ))}
                {has('cut') && (
                    <p className="divider">
                        <span>{has('foreground') ? '다시 연결' : '소켓 끊김'}</span>
                    </p>
                )}
                {has('catchup') && rows.map((row) => <Bubble key={`${row.kind}-${row.message.id}`} message={row.message} kind={row.kind} tag={TAGS[row.kind]} />)}
                {has('catchup') && filtered.length > 0 && (
                    <p className="filtered">
                        다시 온 <Quote text={filtered[0].text} after="는" /> id로 걸러짐
                    </p>
                )}
            </div>
        </section>
    );
};

export const App = () => {
    const [step, setStep] = useState(END); // 지금까지 일어난 일의 개수. 처음에는 끝난 상태를 보여준다
    const [playing, setPlaying] = useState(false);

    const done = step >= END;
    const happened = TIMELINE.slice(0, step);

    useEffect(() => {
        if (!playing) return;
        if (done) {
            setPlaying(false);
            return;
        }
        const timer = setTimeout(() => setStep((value) => value + 1), delayBefore(TIMELINE[step]));
        return () => clearTimeout(timer);
    }, [playing, step, done]);

    const play = () => {
        if (prefersReducedMotion()) {
            setStep(END);
            return;
        }
        setStep(0);
        setPlaying(true);
    };

    const missing = reconnect(MESSAGES, RECEIVED_IDS, LAST_RECEIVED_ID, 'gt').rows.find((row) => row.kind === 'missing');
    const filtered = reconnect(MESSAGES, RECEIVED_IDS, LAST_RECEIVED_ID, 'gte-filter').filtered;

    return (
        <main className="page">
            <p aria-live="polite" className={`guide ${done ? 'guide-bad' : ''}`}>
                {done ? (
                    <>
                        왼쪽은 같은 {short(anchor)}에 저장된 <Quote text={missing?.message.text ?? ''} after="가" /> 채팅에서 빠졌다.
                        <span className="guide-detail">
                            오른쪽은 같은 시각까지 받고, 다시 온 <Quote text={filtered[0]?.text ?? ''} after="는" /> id로 걸러서 빠진 메시지가 없다.
                        </span>
                    </>
                ) : (
                    caption(happened[happened.length - 1])
                )}
            </p>

            <div className="phones">
                {PHONES.map((phone) => (
                    <Phone key={phone.mode} mode={phone.mode} title={phone.title} happened={happened} />
                ))}
            </div>

            <div className="controls">
                <button type="button" className="primary" onClick={play} disabled={playing}>
                    {playing ? '재생 중' : '재생'}
                </button>
            </div>
        </main>
    );
};
