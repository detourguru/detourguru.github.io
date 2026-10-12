import { z } from 'zod';

import type { EvidenceJson } from './schema';

export const WORKER_URL: string | undefined = import.meta.env.VITE_QA_WORKER_URL || undefined;

const LiveResponseSchema = z.object({
    model: z.string(),
    judgements: z.array(z.unknown()),
});

export type LiveResponse = z.infer<typeof LiveResponseSchema>;

export const judgeLive = async (evidence: EvidenceJson, signal: AbortSignal): Promise<LiveResponse> => {
    if (!WORKER_URL) throw new Error('VITE_QA_WORKER_URL이 설정되지 않았습니다');
    const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario: 'dohyun-foreign-content', evidence }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Worker 응답 ${res.status}: ${text.slice(0, 200)}`);
    return LiveResponseSchema.parse(JSON.parse(text));
};
