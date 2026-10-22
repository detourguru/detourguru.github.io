import type { Casting } from './consensus';

export const ROLE_ORDER = ['래리 머피', '신시아 머피', '재러드', '알라나'];

export const TRUTH: Casting = {
    '래리 머피': ['A'],
    '신시아 머피': ['C'],
    재러드: ['D'],
    알라나: ['E'],
};

export type Sample = { label: string; error: string; casting: Casting };

export const SAMPLES: Sample[] = [
    {
        label: '응답 1',
        error: '유령 배역',
        casting: { '래리 머피': ['A'], '신시아 머피': ['C'], 재러드: ['D'], 알라나: ['E'], Unnamed: ['E'] },
    },
    {
        label: '응답 2',
        error: '열 밀림',
        casting: { '래리 머피': ['A'], '신시아 머피': ['A'], 재러드: ['D'], 알라나: ['E'] },
    },
    {
        label: '응답 3',
        error: '배역명 오독',
        casting: { '래리 머피': ['A'], '신시아 머피': ['C'], 재럴드: ['D'], 알라나: ['E'] },
    },
];
