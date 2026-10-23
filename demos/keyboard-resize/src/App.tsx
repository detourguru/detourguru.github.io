import { useEffect, useRef, useState } from 'react';

import { keyboardProgress, type Mode, resizeDelay } from './keyboard';
import { END_MS, KEYBOARD_ANIMATION_MS, KEYBOARD_HEIGHT, MESSAGES, SCREEN_HEIGHT, SLOW } from './samples';

const PHONES: { mode: Mode; title: string }[] = [
    { mode: 'original', title: '플러그인 원본' },
    { mode: 'patched', title: '패치 후' },
];

const ORIGINAL_RESIZE_MS = resizeDelay('original', KEYBOARD_ANIMATION_MS);
// 움직임 줄이기 설정이면 재생 대신 이 순간을 보여준다. 키보드는 다 올라왔고 원본은 아직 웹뷰를 줄이지 않았다
const STILL_MS = Math.round((KEYBOARD_ANIMATION_MS + ORIGINAL_RESIZE_MS) / 2);

const seconds = (ms: number) => `${Number((ms / 1000).toFixed(2))}초`;
const percent = (ms: number) => `${(ms / END_MS) * 100}%`;
const clamp = (ms: number) => Math.min(Math.max(ms, 0), END_MS);

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type Phase = 'idle' | 'rising' | 'waiting' | 'done';

const phaseOf = (elapsed: number): Phase => {
    if (elapsed <= 0) return 'idle';
    if (elapsed < KEYBOARD_ANIMATION_MS) return 'rising';
    if (elapsed < ORIGINAL_RESIZE_MS) return 'waiting';
    return 'done';
};

type Guide = { text: string; detail: string };

// 재생하는 동안에는 문장을 바꾸지 않는다. 화면을 보는 동안 글이 바뀌면 둘 다 놓친다
const PLAYING_GUIDE: Guide = {
    text: '두 화면의 입력창을 동시에 눌렀다.',
    detail: '빨간 점선이 키보드에 가려진 입력창이다.',
};

const GUIDE: Record<Phase, Guide> = {
    idle: {
        text: '재생을 누르면 두 화면의 입력창을 동시에 누른다.',
        detail: '아래 막대를 끌어서 원하는 순간을 볼 수도 있다.',
    },
    rising: {
        text: '키보드가 올라오는 중이다.',
        detail: '패치 후 화면은 웹뷰를 이미 줄여서 입력창이 키보드 위에 있다.',
    },
    waiting: {
        text: '키보드는 다 올라왔는데 원본 화면은 아직 웹뷰를 줄이지 않았다.',
        detail: '그래서 입력창이 키보드에 가려져 있다.',
    },
    done: {
        text: `원본 화면은 ${seconds(ORIGINAL_RESIZE_MS)}가 돼서야 웹뷰를 줄였다.`,
        detail: `키보드 애니메이션 시간 ${seconds(KEYBOARD_ANIMATION_MS)}에 0.2초를 더 기다려서이다.`,
    },
};

const Phone = ({ mode, title, elapsed }: { mode: Mode; title: string; elapsed: number }) => {
    const started = elapsed > 0;
    const resized = started && elapsed >= resizeDelay(mode, KEYBOARD_ANIMATION_MS);
    const covered = started && !resized;
    const progress = keyboardProgress(elapsed, KEYBOARD_ANIMATION_MS);

    return (
        <section className="phone" aria-label={`${title} 화면`}>
            <p className="phone-title">{title}</p>
            <div className="phone-screen" style={{ height: SCREEN_HEIGHT }}>
                <div className="webview" style={{ height: resized ? SCREEN_HEIGHT - KEYBOARD_HEIGHT : SCREEN_HEIGHT }}>
                    <div className="chat" aria-hidden="true">
                        {MESSAGES.map((message) => (
                            <span key={message.id} className={message.mine ? 'bubble is-mine' : 'bubble'} style={{ width: `${message.width}%` }} />
                        ))}
                    </div>
                    <div className="input-bar">
                        <span className={resized ? 'input-field is-visible' : 'input-field'}>입력창</span>
                    </div>
                </div>
                {/* 키보드는 웹뷰 위에 겹쳐 뜬다. 웹뷰를 줄이기 전까지는 아래쪽을 가린다 */}
                <div className="keyboard" style={{ height: KEYBOARD_HEIGHT, transform: `translateY(${(1 - progress) * 100}%)` }} aria-hidden="true">
                    키보드
                </div>
                {covered && <span className="input-ghost">입력창</span>}
            </div>
        </section>
    );
};

const MARKS = [
    { ms: KEYBOARD_ANIMATION_MS, text: '키보드 다 올라옴' },
    { ms: ORIGINAL_RESIZE_MS, text: '원본 웹뷰 줄임' },
];

const STEP_KEYS: Record<string, number> = { ArrowLeft: -10, ArrowDown: -10, ArrowRight: 10, ArrowUp: 10 };

const Scrubber = ({ elapsed, onSeek }: { elapsed: number; onSeek: (ms: number) => void }) => {
    const track = useRef<HTMLDivElement>(null);

    const seekAt = (clientX: number) => {
        const rect = track.current?.getBoundingClientRect();
        if (!rect) return;
        onSeek(clamp(Math.round((((clientX - rect.left) / rect.width) * END_MS) / 10) * 10));
    };

    return (
        <div className="scrubber">
            <div className="scrub-head">
                <p className="scrub-now">
                    입력창을 누른 뒤 <b>{seconds(elapsed)}</b>
                </p>
                <span className="scrub-legend">원본 입력창 가려짐</span>
            </div>
            <div
                ref={track}
                className="scrub-track"
                role="slider"
                tabIndex={0}
                aria-label="입력창을 누른 뒤 지난 시간"
                aria-valuemin={0}
                aria-valuemax={END_MS}
                aria-valuenow={Math.round(elapsed)}
                aria-valuetext={seconds(elapsed)}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    seekAt(event.clientX);
                }}
                onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event.clientX);
                }}
                onKeyDown={(event) => {
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? END_MS : event.key in STEP_KEYS ? elapsed + STEP_KEYS[event.key] : null;
                    if (next === null) return;
                    event.preventDefault();
                    onSeek(clamp(Math.round(next)));
                }}
            >
                <span className="scrub-covered" style={{ width: percent(ORIGINAL_RESIZE_MS) }} />
                {MARKS.map((mark) => (
                    <span key={mark.ms} className="scrub-tick" style={{ left: percent(mark.ms) }} />
                ))}
                <span className="scrub-thumb" style={{ left: percent(elapsed) }} />
            </div>
            <div className="scrub-labels" aria-hidden="true">
                {MARKS.map((mark) => (
                    <span key={mark.ms} style={{ left: percent(mark.ms) }}>
                        <b>{seconds(mark.ms)}</b>
                        {mark.text}
                    </span>
                ))}
            </div>
        </div>
    );
};

export const App = () => {
    const [elapsed, setElapsed] = useState(0); // 입력창을 누른 뒤 지난 시간(ms). 실제 속도 기준
    const [playing, setPlaying] = useState(false);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        if (!playing) return;
        const start = performance.now();
        const tick = (now: number) => {
            const next = Math.min((now - start) / SLOW, END_MS);
            setElapsed(next);
            if (next < END_MS) frame.current = requestAnimationFrame(tick);
            else setPlaying(false);
        };
        frame.current = requestAnimationFrame(tick);
        return () => {
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [playing]);

    const play = () => {
        if (prefersReducedMotion()) {
            setElapsed(STILL_MS);
            return;
        }
        setElapsed(0);
        setPlaying(true);
    };

    const seek = (ms: number) => {
        setPlaying(false);
        setElapsed(ms);
    };

    const guide = playing ? PLAYING_GUIDE : GUIDE[phaseOf(elapsed)];

    return (
        <main className="page">
            <p aria-live="polite" className="guide">
                {guide.text}
                <span className="guide-detail">{guide.detail}</span>
            </p>

            <div className="controls">
                <button type="button" className="primary" onClick={play} disabled={playing}>
                    {playing ? '재생 중' : `${SLOW}배 느리게 재생`}
                </button>
            </div>

            <div className="phones">
                {PHONES.map((phone) => (
                    <Phone key={phone.mode} mode={phone.mode} title={phone.title} elapsed={elapsed} />
                ))}
            </div>

            <Scrubber elapsed={elapsed} onSeek={seek} />

            <p className="footnote">
                키보드 애니메이션 시간 {seconds(KEYBOARD_ANIMATION_MS)}는 예시 값이다. 0.2초는 플러그인 코드에 적힌 값 그대로다.
            </p>
        </main>
    );
};
