import { z } from 'zod';

import { EvidenceJsonSchema, type EvidenceJson } from '../../src/schema.ts';

type Env = {
    ANTHROPIC_API_KEY: string;
    DAILY_CAP?: string;
    PER_IP_PER_MINUTE?: string;
};

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_BODY_BYTES = 20 * 1024;
const ALLOWED_ORIGIN = 'https://detourguru.github.io';
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const SCENARIO_IDS = ['dohyun-foreign-content'] as const;
type ScenarioId = (typeof SCENARIO_IDS)[number];

const SCENARIOS: Record<ScenarioId, string> = {
    'dohyun-foreign-content':
        '도현(22)은 서비스 제한을 우회하는 꼼수를 찾는 사용자다. 남의 콘텐츠 상세 화면에서 편집 진입점이 있는지, ' +
        '비소유자로 수정 요청이 통하는지, 구매 버튼 연타로 두 번 결제되는지, 공유 진입점이 있는지를 확인했다.',
};

const RequestSchema = z
    .object({
        scenario: z.enum(SCENARIO_IDS),
        evidence: EvidenceJsonSchema,
    })
    .strict();

// 일부러 느슨한 스키마다. 확정 근거 규칙은 브라우저 게이트가 검사한다
const OUTPUT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['judgements'],
    properties: {
        judgements: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'grade', 'label', 'detail'],
                properties: {
                    id: { type: 'string' },
                    grade: { type: 'string', enum: ['관찰', '미확인', '확정'] },
                    label: { type: 'string' },
                    detail: { type: 'string' },
                    evidence: {
                        type: 'array',
                        items: {
                            anyOf: [
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['kind', 'id', 'quote'],
                                    properties: { kind: { const: 'log' }, id: { type: 'string' }, quote: { type: 'string' } },
                                },
                                {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['kind', 'selector', 'observed'],
                                    properties: { kind: { const: 'dom' }, selector: { type: 'string' }, observed: { type: 'string' } },
                                },
                            ],
                        },
                    },
                },
            },
        },
    },
} as const;

const SYSTEM_PROMPT = [
    '너는 웹 서비스 QA 판정자다. 페르소나 여정을 실행한 뒤 남긴 증거 JSON만 보고 판정 목록을 만든다.',
    '등급은 세 가지다.',
    '- 관찰: 화면이나 응답에서 본 것을 기록만 함. evidence 필드를 넣지 않는다.',
    '- 미확인: 기대와 다르지만 원인을 증거로 짚을 수 없음. evidence 필드를 넣지 않는다.',
    '- 확정: 서버 응답(log)으로 원인을 짚은 결함. evidence 배열이 필수다.',
    'evidence 항목은 {"kind":"log","id":"log#N","quote":"응답 원문 일부"} 또는 {"kind":"dom","selector":"steps에 기록된 selector 그대로","observed":"관찰 내용"}이다.',
    'log id는 증거 JSON의 log 배열에 있는 것만 쓰고, quote는 그 항목의 status 또는 body를 JSON으로 직렬화한 문자열의 일부를 그대로 옮긴다.',
    '로케이터 하나로 못 찾았다는 사실만으로 기능이 없다고 확정하지 않는다. 같은 대상을 다른 로케이터가 찾았는지 steps를 확인한다.',
    '기획 의도를 모르는 변경(라벨 변경, 버튼이 링크로 바뀐 것 등)은 결함으로 확정하지 않는다.',
    '판정은 한국어로, label은 한 줄, detail은 두 문장 이내로 쓴다. id는 j-1, j-2 처럼 붙인다.',
].join('\n');

const ipHits = new Map<string, number[]>();
let day = '';
let dayCount = 0;

const allowRequest = (ip: string, env: Env): string | null => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
        day = today;
        dayCount = 0;
        ipHits.clear();
    }
    const cap = Number(env.DAILY_CAP ?? '200');
    if (dayCount >= cap) return '오늘 판정 한도를 다 썼습니다';
    const perMin = Number(env.PER_IP_PER_MINUTE ?? '5');
    const now = Date.now();
    const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= perMin) return '요청이 너무 잦습니다. 1분 뒤에 다시 시도하세요';
    recent.push(now);
    ipHits.set(ip, recent);
    dayCount += 1;
    return null;
};

const corsHeaders = (origin: string | null): Record<string, string> => {
    if (!origin || (origin !== ALLOWED_ORIGIN && !LOCAL_ORIGIN.test(origin))) return {};
    return {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'Origin',
    };
};

const json = (status: number, body: unknown, cors: Record<string, string>) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cors } });

const AnthropicResponseSchema = z.object({
    stop_reason: z.string().nullable(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

const callClaude = async (env: Env, scenario: ScenarioId, evidence: EvidenceJson): Promise<unknown[]> => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 1500,
            system: SYSTEM_PROMPT,
            output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
            messages: [
                {
                    role: 'user',
                    content: `시나리오: ${SCENARIOS[scenario]}\n\n증거 JSON:\n${JSON.stringify(evidence)}`,
                },
            ],
        }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = AnthropicResponseSchema.parse(await res.json());
    if (data.stop_reason === 'refusal') throw new Error('모델이 응답을 거절했습니다');
    if (data.stop_reason === 'max_tokens') throw new Error('응답이 max_tokens에서 잘렸습니다');
    const text = data.content.find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('텍스트 응답이 없습니다');
    const parsed = z.object({ judgements: z.array(z.unknown()) }).parse(JSON.parse(text));
    return parsed.judgements;
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const cors = corsHeaders(request.headers.get('origin'));
        const allowedOrigin = 'access-control-allow-origin' in cors;

        if (request.method === 'OPTIONS') return new Response(null, { status: allowedOrigin ? 204 : 403, headers: cors });
        if (!allowedOrigin) return json(403, { error: '허용되지 않은 출처' }, cors);
        if (request.method !== 'POST') return json(405, { error: 'POST만 받습니다' }, cors);
        if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
            return json(415, { error: 'application/json만 받습니다' }, cors);
        }
        const declared = Number(request.headers.get('content-length') ?? '0');
        if (declared > MAX_BODY_BYTES) return json(413, { error: '본문이 너무 큽니다' }, cors);

        const bodyText = await request.text();
        if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) return json(413, { error: '본문이 너무 큽니다' }, cors);

        let body: unknown;
        try {
            body = JSON.parse(bodyText);
        } catch {
            return json(400, { error: 'JSON이 아닙니다' }, cors);
        }
        const parsed = RequestSchema.safeParse(body);
        if (!parsed.success) return json(400, { error: '요청 형식이 맞지 않습니다' }, cors);

        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const blocked = allowRequest(ip, env);
        if (blocked) return json(429, { error: blocked }, cors);

        try {
            const judgements = await callClaude(env, parsed.data.scenario, parsed.data.evidence);
            return json(200, { model: MODEL, judgements }, cors);
        } catch (e) {
            console.error(e);
            return json(502, { error: '판정 생성에 실패했습니다' }, cors);
        }
    },
};
