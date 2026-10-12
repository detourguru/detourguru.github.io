import { z } from 'zod';

// Worker도 이 파일을 번들하므로 zod 말고는 import하지 않는다

export const GRADES = ['관찰', '미확인', '확정'] as const;

export const LogEvidenceSchema = z.object({
    kind: z.literal('log'),
    id: z.string().regex(/^log#\d+$/),
    quote: z.string().min(1).max(300),
});

export const DomEvidenceSchema = z.object({
    kind: z.literal('dom'),
    selector: z.string().min(1).max(200),
    observed: z.string().min(1).max(300),
});

export const EvidenceSchema = z.discriminatedUnion('kind', [LogEvidenceSchema, DomEvidenceSchema]);

const base = {
    id: z.string().min(1).max(40),
    label: z.string().min(1).max(200),
    detail: z.string().max(1000),
};

// zod 4의 nonempty는 T[]로 추론되므로 근거는 tuple로 쓴다
export const JudgementSchema = z.discriminatedUnion('grade', [
    z.object({ ...base, grade: z.literal('관찰'), evidence: z.never().optional() }).strict(),
    z.object({ ...base, grade: z.literal('미확인'), evidence: z.never().optional() }).strict(),
    z.object({ ...base, grade: z.literal('확정'), evidence: z.tuple([EvidenceSchema], EvidenceSchema) }).strict(),
]);

export const LogEntrySchema = z
    .object({
        id: z.string().regex(/^log#\d+$/),
        method: z.enum(['GET', 'POST', 'PATCH']),
        path: z.string().max(120),
        status: z.number().int(),
        body: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    })
    .strict();

export const LocatorResultSchema = z
    .object({
        selector: z.string().max(200),
        matches: z.number().int().min(0),
        observed: z.string().max(300),
    })
    .strict();

export const StepSchema = z
    .object({
        id: z.string().regex(/^step#\d+$/),
        title: z.string().max(120),
        target: z.string().max(40).optional(),
        locators: z.array(LocatorResultSchema).max(4),
        logIds: z.array(z.string().regex(/^log#\d+$/)).max(10),
        note: z.string().max(400),
    })
    .strict();

export const EvidenceJsonSchema = z
    .object({
        persona: z.string().max(40),
        viewer: z.object({ id: z.string().max(40) }).strict(),
        content: z.object({ id: z.string().max(40), ownerId: z.string().max(40) }).strict(),
        steps: z.array(StepSchema).max(12),
        log: z.array(LogEntrySchema).max(20),
    })
    .strict();

export type Evidence = z.infer<typeof EvidenceSchema>;
export type LogEvidence = z.infer<typeof LogEvidenceSchema>;
export type DomEvidence = z.infer<typeof DomEvidenceSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type LocatorResult = z.infer<typeof LocatorResultSchema>;
export type Step = z.infer<typeof StepSchema>;
export type EvidenceJson = z.infer<typeof EvidenceJsonSchema>;
