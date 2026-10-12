import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { VirtuosoList } from './lists/VirtuosoList';
import type { MessageKind } from './messages';
import { AT_BOTTOM_PX, useLiveMetrics, type MetricsEvent } from './metrics';
import { createMountRegistry } from './mountRegistry';
import { useFlashLines } from './useFlashLines';
import { useMessageFeed } from './useMessageFeed';
import { useScenario, type ScenarioActions, type ScenarioResult } from './useScenario';
import { guideFor, TUTORIAL_START, tutorialReducer, useTutorialCompletion, type Side } from './useTutorial';

const EVENT_LINE_MS = 4000;

const SIDE_LABEL: Record<Side, string> = { before: '고치기 전', after: '고친 뒤' };

const LATE_KINDS: readonly MessageKind[] = ['image', 'choices', 'stream'];

const simulateWheel = (el: HTMLElement, deltaY: number) => {
    el.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true }));
    el.scrollBy({ top: deltaY });
};

const Num = (props: { value: number; unit: string }) => (
    <>
        <b className={props.value > 0 ? 'bad' : 'good'}>{props.value}</b>
        {props.unit}
    </>
);

const ResultLine = (props: { side: Side; result: ScenarioResult }) => (
    <span>
        {SIDE_LABEL[props.side]}: 바닥 미달 <Num value={props.result.miss} unit="회" />, 흔들림 <Num value={props.result.shift} unit="px" />
    </span>
);

export const App = () => {
    const [side, setSide] = useState<Side>('before');
    const sideRef = useRef<Side>('before');
    const autoRunningRef = useRef(false);
    const suppressMarkersRef = useRef(false);
    const sendFramesRef = useRef(new Set<number>());
    const [listEpoch, setListEpoch] = useState(0);
    const [results, setResults] = useState<Partial<Record<Side, ScenarioResult>>>({});
    const [registry] = useState(createMountRegistry);
    const [scroller, setScroller] = useState<HTMLElement | null>(null);
    const scrollerRef = useRef<HTMLElement | null>(null);
    const [tutorial, dispatchTutorial] = useReducer(tutorialReducer, TUTORIAL_START);

    const flash = useFlashLines(EVENT_LINE_MS);
    const [missFlashKey, setMissFlashKey] = useState(0);
    const pushFlash = flash.push;
    const handleMetricsEvent = useCallback(
        (event: MetricsEvent) => {
            if (suppressMarkersRef.current) return;
            if (event.kind === 'miss') {
                pushFlash(`바닥에서 ${event.px}px 떨어진 채 멈춤`, event.cause);
                setMissFlashKey((n) => n + 1);
            } else if (event.kind === 'shake') {
                pushFlash(`가만히 있는데 ${event.px}px 흔들림`, event.cause);
            }
            if (!autoRunningRef.current) dispatchTutorial({ type: 'event', event, side: sideRef.current });
        },
        [pushFlash],
    );
    const metrics = useLiveMetrics(scroller, handleMetricsEvent);
    const feed = useMessageFeed({ onAppend: metrics.noteAppend, onContentChange: metrics.noteContentChange });
    const scenario = useScenario();
    useTutorialCompletion(tutorial, side, dispatchTutorial, metrics.getSnapshot);

    // 이전 Virtuoso가 새 목록이 붙은 뒤에 null을 보내므로 null로 덮어쓰지 않는다
    const handleScrollerChange = useCallback((el: HTMLElement | null) => {
        if (!el) return;
        scrollerRef.current = el;
        setScroller(el);
    }, []);

    // 렌더 전에 기록을 비워야 새 목록의 첫 마운트가 재마운트로 잡히지 않는다
    const remountList = () => {
        registry.reset();
        flash.clear();
        metrics.reset();
        setListEpoch((n) => n + 1);
    };

    const changeSide = (next: Side) => {
        sideRef.current = next;
        setSide(next);
    };

    const selectSide = (next: Side) => {
        if (next === side) return;
        scenario.stop();
        remountList();
        changeSide(next);
        dispatchTutorial({ type: 'switched' });
    };

    useEffect(() => {
        const frames = sendFramesRef.current;
        return () => {
            for (const id of frames) cancelAnimationFrame(id);
            frames.clear();
        };
    }, []);

    const send = () => {
        const el = scrollerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        metrics.markAtBottom();
        const kind = LATE_KINDS[Math.floor(Math.random() * LATE_KINDS.length)];
        const frames = sendFramesRef.current;
        const id = requestAnimationFrame(() => {
            frames.delete(id);
            feed.add(kind);
        });
        frames.add(id);
        dispatchTutorial({ type: 'send', side });
    };

    const restart = () => {
        scenario.stop();
        feed.reset();
        remountList();
        changeSide('before');
        setResults({});
        dispatchTutorial({ type: 'reset' });
    };

    const watchAuto = async () => {
        const runSide = side;
        const actions: ScenarioActions = {
            restart: () => {
                feed.reset();
                remountList();
            },
            alignToBottom: () => {
                const el = scrollerRef.current;
                if (el) el.scrollTop = el.scrollHeight;
            },
            resetMeasurements: () => {
                metrics.reset();
                suppressMarkersRef.current = false;
            },
            add: feed.add,
            burst: feed.burst,
            wheel: (deltaY) => {
                const el = scrollerRef.current;
                if (el) simulateWheel(el, deltaY);
            },
            read: metrics.getSnapshot,
        };
        autoRunningRef.current = true;
        suppressMarkersRef.current = true;
        try {
            const result = await scenario.run(actions);
            if (result) setResults((prev) => ({ ...prev, [runSide]: result }));
        } finally {
            autoRunningRef.current = false;
            suppressMarkersRef.current = false;
        }
    };

    const distance = metrics.snapshot.distance;
    const guide = guideFor(tutorial, side);
    const ranSides = (['before', 'after'] as const).filter((s) => results[s]);

    return (
        <main className="page">
            <header className="title">
                <h1>채팅 바닥 고정</h1>
                <a href="/posts/virtuoso-chat-bottom/" target="_top">
                    글로 돌아가기
                </a>
            </header>
            <p className="desc">메시지가 늦게 커지면 스크롤이 바닥에서 떨어진다.</p>

            <p className={`guide guide-${guide.tone}`} data-testid="guide" aria-live="polite">
                <span>
                    {guide.counter ? <span className="guide-counter">{guide.counter}</span> : null}
                    {guide.text}
                </span>
                {guide.detail ? <span className="guide-detail">{guide.detail}</span> : null}
            </p>

            <div className="screen chat-screen">
                <span className={distance > AT_BOTTOM_PX ? 'distance bad' : 'distance'} data-testid="distance">
                    바닥까지 {distance}px
                </span>
                <div className="events" aria-live="polite" data-testid="events">
                    {flash.lines.map((line) => (
                        <div key={line.id} className="event" style={{ animationDuration: `${EVENT_LINE_MS}ms` }}>
                            <p>{line.text}</p>
                            {line.cause ? <p className="event-cause">{line.cause}</p> : null}
                        </div>
                    ))}
                </div>
                {missFlashKey > 0 ? <span key={`flash-${missFlashKey}`} className="miss-flash" aria-hidden="true" /> : null}
                <VirtuosoList
                    key={`list-${listEpoch}`}
                    messages={feed.messages}
                    fixed={side === 'after'}
                    registry={registry}
                    scroller={scroller}
                    onScrollerChange={handleScrollerChange}
                />
            </div>

            <div className="controls">
                <div className="switch" role="group" aria-label="비교 대상">
                    {(['before', 'after'] as const).map((s) => (
                        <button key={s} type="button" aria-pressed={side === s} onClick={() => selectSide(s)}>
                            {SIDE_LABEL[s]}
                        </button>
                    ))}
                </div>
                <button type="button" className="primary" onClick={send} disabled={scenario.running}>
                    메시지 보내기
                </button>
                <button type="button" onClick={watchAuto} disabled={scenario.running}>
                    자동으로 보기
                </button>
                <button type="button" onClick={restart}>
                    처음부터
                </button>
            </div>

            <p className="readout" data-testid="readout" aria-live="polite">
                {scenario.running
                    ? `${scenario.phase}…`
                    : ranSides.map((s, i) => {
                          const result = results[s];
                          return result ? (
                              <span key={s}>
                                  {i > 0 ? ' / ' : null}
                                  <ResultLine side={s} result={result} />
                              </span>
                          ) : null;
                      })}
            </p>
        </main>
    );
};
