import type { Judgement } from './judgement';

export const typeTests: Judgement[] = [
    // @ts-expect-error
    { id: 'a', grade: '확정', label: '', detail: '', evidence: null },
    // @ts-expect-error
    { id: 'b', grade: '확정', label: '', detail: '', evidence: [] },
    // @ts-expect-error
    { id: 'c', grade: '확정', label: '', detail: '', evidence: ['버튼을 못 찾음'] },
    // @ts-expect-error
    { id: 'd', grade: '관찰', label: '', detail: '', evidence: [{ kind: 'log', id: 'log#1', quote: '200' }] },
    { id: 'e', grade: '확정', label: '', detail: '', evidence: [{ kind: 'log', id: 'log#1', quote: '200' }] },
];
