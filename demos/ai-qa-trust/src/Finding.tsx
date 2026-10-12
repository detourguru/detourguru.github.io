import gateSource from './gate.ts?raw';
import { serializeEntry } from './fakeServer';
import type { GateResult } from './gate';
import type { EvidenceJson } from './schema';

export type Spot = 'title' | 'edit' | 'balance' | 'share';

type RawEvidence = { kind: 'log'; id: string; quote: string } | { kind: 'dom'; selector: string; observed: string };

const rawEvidence = (raw: unknown): RawEvidence[] | null => {
    if (typeof raw !== 'object' || raw === null || !('evidence' in raw) || !Array.isArray(raw.evidence)) return null;
    return raw.evidence.filter(
        (e: unknown): e is RawEvidence =>
            typeof e === 'object' && e !== null && 'kind' in e && (e.kind === 'log' || e.kind === 'dom'),
    );
};

export const spotsOf = (result: GateResult, run: EvidenceJson): Spot[] => {
    const spots = new Set<Spot>();
    for (const ev of rawEvidence(result.raw) ?? []) {
        if (ev.kind === 'log') {
            const entry = run.log.find((l) => l.id === ev.id);
            if (entry?.method === 'PATCH') spots.add('title');
            if (entry && (entry.path.endsWith('/purchase') || entry.path === '/me')) spots.add('balance');
        } else if (/공유/.test(ev.selector)) {
            spots.add('share');
        } else if (/편집|수정/.test(ev.selector)) {
            spots.add('edit');
        }
    }
    return [...spots];
};

// markerFor의 문구는 gate.ts의 사유 문자열과 맞춰야 한다
const GATE_LINES = gateSource.split('\n');
const markerFor = (reason: string): string => {
    if (gateSource.includes(`'${reason}'`)) return `'${reason}'`;
    if (reason.includes('로그에 없음')) return '이번 실행 로그에 없음';
    if (reason.includes('실제 응답에 없음')) return '실제 응답에 없음';
    if (reason.includes('다른 로케이터')) return '다른 로케이터로 찾으면';
    if (reason.includes('쓰이지 않음')) return '쓰이지 않음';
    if (reason.includes('근거가 하나도 없음')) return '근거가 하나도 없음';
    return '';
};

const codeChunks = (markers: string[]) => {
    const hits = GATE_LINES.flatMap((line, i) => (markers.some((m) => m && line.includes(m)) ? [i] : []));
    const chunks: { from: number; to: number }[] = [];
    for (const h of hits) {
        const from = Math.max(0, h - 1);
        const to = Math.min(GATE_LINES.length - 1, h + 1);
        const last = chunks[chunks.length - 1];
        if (last && from <= last.to + 1) last.to = Math.max(last.to, to);
        else chunks.push({ from, to });
    }
    return { chunks, hits: new Set(hits) };
};

const Quoted = (props: { text: string; quote: string }) => {
    const at = props.text.indexOf(props.quote);
    if (at < 0) return <>{props.text}</>;
    return (
        <>
            {props.text.slice(0, at)}
            <mark>{props.quote}</mark>
            {props.text.slice(at + props.quote.length)}
        </>
    );
};

const EvidenceRow = (props: { ev: RawEvidence; run: EvidenceJson }) => {
    const { ev, run } = props;
    if (ev.kind === 'log') {
        const entry = run.log.find((l) => l.id === ev.id);
        const text = entry ? serializeEntry(entry) : '';
        const ok = entry !== undefined && text.includes(ev.quote);
        return (
            <tr>
                <td>
                    <code>{ev.id}</code> 에 <code>{ev.quote}</code>
                </td>
                <td className={ok ? 'good' : 'bad'}>
                    {entry ? (
                        <code>
                            {entry.method} {entry.path} 응답: <Quoted text={text} quote={ev.quote} />
                        </code>
                    ) : (
                        <span>그런 로그가 없음</span>
                    )}
                </td>
            </tr>
        );
    }
    const used = run.steps.flatMap((s) => s.locators.map((l) => ({ s, l }))).find((x) => x.l.selector === ev.selector);
    const other = used?.s.target
        ? run.steps.flatMap((s) => s.locators.map((l) => ({ s, l }))).find((x) => x.s.target === used.s.target && x.l.matches > 0)
        : undefined;
    const contradicted = used !== undefined && used.l.matches === 0 && other !== undefined;
    return (
        <tr>
            <td>
                <code>{ev.selector}</code>: {ev.observed}
            </td>
            <td className={!used || contradicted ? 'bad' : 'good'}>
                {!used ? (
                    '이번 실행에서 쓰지 않은 로케이터'
                ) : contradicted ? (
                    <>
                        <code>{other.l.selector}</code> 로는 {other.l.observed}
                    </>
                ) : (
                    used.l.observed
                )}
            </td>
        </tr>
    );
};

export const FindingDetail = (props: { result: GateResult; run: EvidenceJson }) => {
    const { result, run } = props;
    const evidence = rawEvidence(result.raw);
    const markers = result.downgraded ? result.reasons.map(markerFor) : ['hasLog = true'];
    const code = codeChunks(markers);
    const tone = result.downgraded ? 'hit-bad' : 'hit-ok';

    return (
        <div className="finding-detail">
            <table className="ev-table">
                <thead>
                    <tr>
                        <th>AI가 댄 근거</th>
                        <th>이번 실행의 실제 기록</th>
                    </tr>
                </thead>
                <tbody>
                    {evidence && evidence.length > 0 ? (
                        evidence.map((ev, i) => <EvidenceRow key={i} ev={ev} run={run} />)
                    ) : (
                        <tr>
                            <td colSpan={2} className="bad">
                                근거 없음
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            {code.chunks.length > 0 && (
                <div className="gate-code" aria-label="gate.ts에서 이 판정을 내린 코드">
                    <p className="gate-file">gate.ts</p>
                    {code.chunks.map((c, ci) => (
                        <pre key={ci}>
                            {GATE_LINES.slice(c.from, c.to + 1).map((line, i) => (
                                <span key={i} className={code.hits.has(c.from + i) ? tone : undefined}>
                                    <span className="ln">{c.from + i + 1}</span>
                                    {line.replace(/^ {8}/, '')}
                                    {'\n'}
                                </span>
                            ))}
                        </pre>
                    ))}
                </div>
            )}
        </div>
    );
};
