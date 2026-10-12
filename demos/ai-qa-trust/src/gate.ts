import { serializeEntry } from './fakeServer';
import { fromParsed, type Grade, type Judgement } from './judgement';
import { JudgementSchema, type EvidenceJson } from './schema';

export type GateResult = {
    raw: unknown;
    rawGrade: Grade | null;
    final: Judgement;
    downgraded: boolean;
    reasons: string[];
};

const isGrade = (v: unknown): v is Grade => v === '관찰' || v === '미확인' || v === '확정';

const field = (raw: unknown, key: string): unknown =>
    typeof raw === 'object' && raw !== null && key in raw ? (raw as Record<string, unknown>)[key] : undefined;

const schemaReason = (raw: unknown): string => {
    const grade = field(raw, 'grade');
    const evidence = field(raw, 'evidence');
    if (grade === '확정') {
        if (evidence === undefined || evidence === null) return '근거 없음';
        if (Array.isArray(evidence) && evidence.length === 0) return '근거 배열이 비어 있음';
        if (Array.isArray(evidence) && evidence.some((e) => typeof e === 'string')) return '근거가 구조체가 아닌 문자열임';
        return '근거 형식 오류';
    }
    if (isGrade(grade) && evidence !== undefined) return `${grade}에는 근거를 붙이지 않음 (형식 오류)`;
    return '판정 형식 오류';
};

const semanticReasons = (j: Extract<Judgement, { grade: '확정' }>, run: EvidenceJson): string[] => {
    const reasons: string[] = [];
    const executed = run.steps.flatMap((s) => s.locators.map((l) => ({ step: s, loc: l })));
    let hasLog = false;

    for (const ev of j.evidence) {
        if (ev.kind === 'log') {
            const entry = run.log.find((l) => l.id === ev.id);
            if (!entry) {
                reasons.push(`근거 ${ev.id}가 이번 실행 로그에 없음`);
                continue;
            }
            if (!serializeEntry(entry).includes(ev.quote)) {
                reasons.push(`근거 ${ev.id}의 인용 ${ev.quote}가 실제 응답에 없음`);
                continue;
            }
            hasLog = true;
        } else {
            const hit = executed.find((x) => x.loc.selector === ev.selector);
            if (!hit) {
                reasons.push(`셀렉터 ${ev.selector}는 이번 실행에서 쓰이지 않음`);
                continue;
            }
            if (hit.loc.matches === 0 && hit.step.target) {
                const other = executed.find((x) => x.step.target === hit.step.target && x.loc.matches > 0);
                if (other) reasons.push(`다른 로케이터로 찾으면 있음: ${other.loc.observed} (${other.loc.selector})`);
            }
        }
    }
    if (!hasLog && reasons.length === 0) reasons.push('화면 관찰만 있고 서버 응답(log) 근거가 없음');
    else if (!hasLog) reasons.push('유효한 서버 응답(log) 근거가 하나도 없음');
    return reasons;
};

export const gateOne = (raw: unknown, run: EvidenceJson, index: number): GateResult => {
    const g = field(raw, 'grade');
    const rawGrade = isGrade(g) ? g : null;
    const parsed = JudgementSchema.safeParse(raw);
    if (!parsed.success) {
        const label = field(raw, 'label');
        const detail = field(raw, 'detail');
        const id = field(raw, 'id');
        return {
            raw,
            rawGrade,
            downgraded: rawGrade === '확정',
            reasons: [schemaReason(raw)],
            final: {
                id: typeof id === 'string' ? id : `raw-${index + 1}`,
                grade: '미확인',
                label: typeof label === 'string' ? label : '(라벨 없음)',
                detail: typeof detail === 'string' ? detail : '',
            },
        };
    }
    const j = fromParsed(parsed.data);
    if (j.grade !== '확정') return { raw, rawGrade, final: j, downgraded: false, reasons: [] };
    const reasons = semanticReasons(j, run);
    if (reasons.length === 0) return { raw, rawGrade, final: j, downgraded: false, reasons: [] };
    return {
        raw,
        rawGrade,
        downgraded: true,
        reasons,
        final: { id: j.id, grade: '미확인', label: j.label, detail: j.detail },
    };
};

export type GateSummary = {
    rawConfirmed: number;
    finalConfirmed: number;
    downgraded: number;
    tickets: string[];
};

export const gateAll = (raws: readonly unknown[], run: EvidenceJson): { results: GateResult[]; summary: GateSummary } => {
    const results = raws.map((r, i) => gateOne(r, run, i));
    const finals = results.filter((r) => r.final.grade === '확정');
    return {
        results,
        summary: {
            rawConfirmed: results.filter((r) => r.rawGrade === '확정').length,
            finalConfirmed: finals.length,
            downgraded: results.filter((r) => r.downgraded).length,
            tickets: finals.map((r) => r.final.label),
        },
    };
};
