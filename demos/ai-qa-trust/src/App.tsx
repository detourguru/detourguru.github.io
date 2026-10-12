import { useEffect, useMemo, useRef, useState } from 'react';

import { gateAll } from './gate';
import { createFakeServer, comboKey, type Bugs } from './fakeServer';
import { FindingDetail, spotsOf } from './Finding';
import { clearHighlight, runDohyunJourney, type StepView } from './runner';
import { lookupSample, samplesFile } from './samples';
import type { EvidenceJson } from './schema';
import { createTargetController } from './targetApp/controller';
import { TargetApp } from './targetApp/TargetApp';

const BUGS: Bugs = { permission: true, doublePay: true, shareLabel: true };
const STEP_DELAY = 350;
const CHECK_DELAY = 600;

const newSession = () => {
    const server = createFakeServer(BUGS);
    return { server, app: createTargetController(server) };
};

export const App = () => {
    const [phase, setPhase] = useState<'idle' | 'running' | 'found' | 'checking' | 'checked' | 'error'>('idle');
    const [views, setViews] = useState<StepView[]>([]);
    const [evidence, setEvidence] = useState<EvidenceJson | null>(null);
    const [checkedCount, setCheckedCount] = useState(0);
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [session, setSession] = useState(newSession);
    const runAbort = useRef<AbortController | null>(null);
    const appRoot = useRef<HTMLDivElement | null>(null);

    useEffect(() => () => runAbort.current?.abort(), []);

    const gated = useMemo(() => {
        if (!evidence) return null;
        const sample = lookupSample(comboKey(BUGS), evidence.log);
        return sample.kind === 'ok' ? gateAll(sample.judgements, evidence) : null;
    }, [evidence]);
    const claimed = gated ? gated.results.filter((r) => r.rawGrade === '확정') : [];
    const passed = claimed.filter((r) => !r.downgraded);

    useEffect(() => {
        if (phase !== 'checking') return;
        if (checkedCount >= claimed.length) {
            setPhase('checked');
            return;
        }
        const t = setTimeout(() => setCheckedCount((n) => n + 1), CHECK_DELAY);
        return () => clearTimeout(t);
    }, [phase, checkedCount, claimed.length]);

    const runQa = async () => {
        runAbort.current?.abort();
        const ac = new AbortController();
        runAbort.current = ac;
        // 실행마다 서버를 새로 만들어야 로그 id가 samples.json과 맞는다
        const next = newSession();
        setSession(next);
        setViews([]);
        setEvidence(null);
        setCheckedCount(0);
        setOpenIndex(null);
        setPhase('running');
        try {
            const res = await runDohyunJourney({
                getRoot: () => appRoot.current,
                server: next.server,
                app: next.app,
                signal: ac.signal,
                stepDelay: STEP_DELAY,
                onProgress: setViews,
            });
            if (ac.signal.aborted) return;
            setEvidence(res.evidence);
            setPhase('found');
        } catch {
            if (!ac.signal.aborted) setPhase('error');
        } finally {
            if (runAbort.current === ac) clearHighlight(appRoot.current);
        }
    };

    const opened = openIndex !== null ? claimed[openIndex] : undefined;
    const spots = opened && evidence ? spotsOf(opened, evidence) : [];
    const current = views.find((v) => v.status === 'running') ?? views[views.length - 1];
    const firstBad = claimed.findIndex((r) => r.downgraded);

    const guide: { counter?: string; text: string; tone?: 'good' } =
        phase === 'idle'
            ? { counter: '1/3', text: 'AI QA 돌리기를 눌러 보세요. AI가 이 앱을 직접 눌러 보고 결함을 찾습니다.' }
            : phase === 'running'
              ? { text: `AI가 앱을 누르는 중… ${current?.title ?? ''}` }
              : phase === 'found'
                ? { counter: '2/3', text: `AI가 결함 ${claimed.length}건을 ‘확정’했습니다. 전부 진짜일까요? 근거 대조하기를 눌러 보세요.` }
                : phase === 'checking'
                  ? { text: `AI가 댄 근거를 이번 실행의 서버 로그와 대조하는 중… ${checkedCount}/${claimed.length}` }
                  : phase === 'checked' && openIndex === null
                    ? { counter: '3/3', text: `${claimed.length - passed.length}건은 근거가 로그와 맞지 않았습니다. 빨간 항목을 눌러 무엇이 틀렸는지 보세요.` }
                    : phase === 'checked'
                      ? { text: `근거가 실제 로그와 맞는 ${passed.length}건만 일감으로 올라갑니다.`, tone: 'good' }
                      : { text: '실행 중 오류가 났습니다. 다시 돌려 보세요.' };

    return (
        <main className="page">
            <div className="title">
                <h1>AI QA 판정 게이트</h1>
                <a href="/posts/ai-qa-trust/" target="_top">
                    글로 돌아가기
                </a>
            </div>
            <p className="desc">AI가 &lsquo;확정&rsquo;한 결함이라도 근거가 서버 로그와 맞지 않으면 일감으로 올리지 않는다.</p>

            <div className="tutorial-bar">
                <p aria-live="polite" className={guide.tone === 'good' ? 'guide good' : 'guide'}>
                    {guide.counter && <span className="guide-counter">{guide.counter}</span>}
                    {guide.text}
                </p>
                <div className="tutorial-action">
                    {phase === 'found' ? (
                        <button type="button" className="primary" onClick={() => setPhase('checking')}>
                            근거 대조하기
                        </button>
                    ) : phase === 'checked' && openIndex === null && firstBad >= 0 ? (
                        <button type="button" className="primary" onClick={() => setOpenIndex(firstBad)}>
                            빨간 항목 열어 보기
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={phase === 'idle' ? 'primary' : undefined}
                            onClick={() => void runQa()}
                            disabled={phase === 'running' || phase === 'checking'}
                        >
                            {phase === 'idle' ? 'AI QA 돌리기' : '처음부터'}
                        </button>
                    )}
                </div>
            </div>

            <div className="screen qa-screen">
                <div className="qa-app">
                    <TargetApp controller={session.app} shareAsLink={BUGS.shareLabel} containerRef={appRoot} spots={spots} />
                </div>
                <div className="qa-findings" aria-live="polite">
                    <p className="qa-head">AI가 확정한 결함</p>
                    {(phase === 'idle' || phase === 'running') && <p className="muted">아직 없음</p>}
                    {phase === 'error' && <p className="bad">실행 오류</p>}
                    {evidence && !gated && <p className="muted">이 실행과 맞는 판정 샘플이 없습니다.</p>}
                    {gated && (
                        <ol className="qa-list">
                            {claimed.map((r, i) => {
                                const checked = i < checkedCount;
                                const bad = checked && r.downgraded;
                                const open = openIndex === i;
                                return (
                                    <li key={i} className={bad ? 'is-blocked' : undefined}>
                                        <button
                                            type="button"
                                            className="qa-item"
                                            aria-expanded={open}
                                            disabled={phase !== 'checked'}
                                            onClick={() => setOpenIndex(open ? null : i)}
                                        >
                                            <span className="qa-label">{r.final.label}</span>
                                            {checked && (
                                                <span className={r.downgraded ? 'qa-check bad' : 'qa-check good'}>
                                                    {r.downgraded ? `✕ ${r.reasons[0]}` : '✓ 근거가 로그와 일치'}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
                {opened && evidence && (
                    <div className="qa-detail">
                        <FindingDetail result={opened} run={evidence} />
                    </div>
                )}
            </div>

            {gated && samplesFile.source !== 'recorded' && (
                <p className="footnote">AI 판정은 샘플 응답입니다. 근거 대조는 이 화면에서 실제로 실행됩니다.</p>
            )}
        </main>
    );
};
