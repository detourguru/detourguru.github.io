import type { Version } from './AreaScreen';

export type Case = 'pan' | 'move' | 'area';

export const CASE_LABEL: Record<Case, string> = { pan: '화면 이동', move: '카드 옮기기', area: '다른 지역' };
export const VERSION_LABEL: Record<Version, string> = { before: '고치기 전', after: '고친 뒤' };

interface Step {
    caseId: Case;
    version: Version;
    act: string;
}

const STEPS: readonly Step[] = [
    { caseId: 'pan', version: 'before', act: '화면 옮기기를 눌러 보세요' },
    { caseId: 'pan', version: 'after', act: '화면 옮기기를 다시 눌러 보세요' },
    { caseId: 'move', version: 'before', act: '광장을 두 칸 아래로 끌어 보세요' },
    { caseId: 'move', version: 'after', act: '광장을 똑같이 옮겨 보세요' },
    { caseId: 'area', version: 'before', act: '빨간 화살표를 확인해 보세요' },
    { caseId: 'area', version: 'after', act: '' },
];

export type Tutorial = ReadonlySet<number>;
export const TUTORIAL_START: Tutorial = new Set();

export interface Observation {
    caseId: Case;
    version: Version;
    detected: boolean;
}

const stepIndex = (caseId: Case, version: Version) => STEPS.findIndex((s) => s.caseId === caseId && s.version === version);

export const tutorialReducer = (done: Tutorial, { caseId, version, detected }: Observation): Tutorial => {
    const index = stepIndex(caseId, version);
    const passed = version === 'before' ? detected : !detected && done.has(index - 1);
    if (!passed || done.has(index)) return done;
    return new Set(done).add(index);
};

const objectParticle = (word: string) => {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    return code >= 0 && code <= 11171 && code % 28 !== 0 ? '을' : '를';
};

export interface Guide {
    counter: string | null;
    text: string;
}

export const guideFor = (done: Tutorial, caseId: Case, version: Version): Guide => {
    const view = stepIndex(caseId, version);
    const here = version === 'after' && !done.has(view - 1) ? view - 1 : view;
    const index = done.has(here) ? STEPS.findIndex((_, i) => !done.has(i)) : here;
    if (index === -1) return { counter: null, text: '세 문제를 모두 확인했습니다' };

    const step = STEPS[index];
    const picks = [
        step.caseId !== caseId ? CASE_LABEL[step.caseId] : null,
        step.version !== version ? VERSION_LABEL[step.version] : null,
    ].filter((label): label is string => label !== null);
    const pick = picks.length > 0 ? `${picks.join(', ')}${objectParticle(picks[picks.length - 1])} 고르` : '';
    const text = pick === '' ? step.act : step.act === '' ? `${pick}세요` : `${pick}고 ${step.act}`;
    return { counter: `${index + 1}/${STEPS.length}`, text };
};
