import type { Casting } from './consensus';

export const ROLES = ['래리 머피', '신시아 머피'];

export const TRUTH: Casting = { '래리 머피': ['🐻'], '신시아 머피': ['🐰'] };

export const REQUESTS: Casting[] = [
    { '래리 머피': ['🐻'], '신시아 머피': ['🐻'] },
    { '래리 머피': ['🐻'], '신시아 머피': ['🐰'] },
    { '래리 머피': ['🐰'], '신시아 머피': ['🐰'] },
];
