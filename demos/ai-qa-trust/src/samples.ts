import { z } from 'zod';

import rawFile from './samples.json';
import type { LogEntry } from './schema';

const SamplesFileSchema = z.object({
    source: z.enum(['synthetic', 'recorded']),
    note: z.string(),
    model: z.string().optional(),
    recordedAt: z.string().optional(),
    combos: z.record(
        z.string(),
        z.object({
            fingerprint: z.array(z.string()),
            judgements: z.array(z.unknown()),
        }),
    ),
});

export const samplesFile = SamplesFileSchema.parse(rawFile);

export const fingerprint = (log: readonly LogEntry[]): string[] => log.map((l) => `${l.id} ${l.method} ${l.path} ${l.status}`);

export type SampleLookup =
    | { kind: 'ok'; judgements: unknown[] }
    | { kind: 'missing' }
    | { kind: 'mismatch'; expected: string[]; actual: string[] };

export const lookupSample = (key: string, log: readonly LogEntry[]): SampleLookup => {
    const entry = samplesFile.combos[key];
    if (!entry) return { kind: 'missing' };
    const actual = fingerprint(log);
    if (entry.fingerprint.join('\n') !== actual.join('\n')) return { kind: 'mismatch', expected: entry.fingerprint, actual };
    return { kind: 'ok', judgements: entry.judgements };
};
