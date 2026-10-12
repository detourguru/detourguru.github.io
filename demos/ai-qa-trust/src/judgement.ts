import type { z } from 'zod';

import type { Evidence, JudgementSchema } from './schema';

export type Grade = '관찰' | '미확인' | '확정';

type Base = { id: string; label: string; detail: string };

export type Judgement =
    | (Base & { grade: '관찰' | '미확인'; evidence?: never })
    | (Base & { grade: '확정'; evidence: readonly [Evidence, ...Evidence[]] });

export type Confirmed = Extract<Judgement, { grade: '확정' }>;

export const fromParsed = (parsed: z.infer<typeof JudgementSchema>): Judgement => parsed;

export const observed = (id: string, label: string, detail: string): Judgement => ({ id, grade: '관찰', label, detail });

export const unverified = (id: string, label: string, detail: string): Judgement => ({ id, grade: '미확인', label, detail });

export const confirmed = (
    id: string,
    label: string,
    detail: string,
    evidence: readonly [Evidence, ...Evidence[]],
): Judgement => ({ id, grade: '확정', label, detail, evidence });
