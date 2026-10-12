import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type LogEntry = { id: string; method: string; path: string; status: number };

const here = dirname(fileURLToPath(import.meta.url));
const workerUrl = process.argv[2];
if (!workerUrl) {
    console.error('사용법: node --experimental-strip-types record-samples.ts <Worker URL>');
    process.exit(1);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const combos: Record<string, { fingerprint: string[]; judgements: unknown[] }> = {};
let model = '';
const files = readdirSync(join(here, 'evidence')).filter((f) => /^evidence-[01]{3}\.json$/.test(f));

for (const file of files) {
    const key = file.slice('evidence-'.length, -'.json'.length);
    const evidence: unknown = JSON.parse(readFileSync(join(here, 'evidence', file), 'utf8'));
    if (!isRecord(evidence) || !Array.isArray(evidence.log)) throw new Error(`${file}: 증거 형식이 아님`);
    const res = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ scenario: 'dohyun-foreign-content', evidence }),
    });
    const body: unknown = await res.json();
    if (!res.ok || !isRecord(body) || !Array.isArray(body.judgements) || typeof body.model !== 'string') {
        throw new Error(`${key}: Worker 응답 ${res.status} ${JSON.stringify(body)}`);
    }
    model = body.model;
    const log = evidence.log as LogEntry[];
    combos[key] = {
        fingerprint: log.map((l) => `${l.id} ${l.method} ${l.path} ${l.status}`),
        judgements: body.judgements,
    };
    console.log(`${key}: 판정 ${body.judgements.length}건`);
    await new Promise((r) => setTimeout(r, 13_000)); // Worker의 IP당 분당 제한에 걸리지 않게 쉰다
}

const out = {
    source: 'recorded',
    note: `${model}로 녹화한 실제 응답. 게이트는 이 응답을 손대지 않고 그대로 검사한다.`,
    model,
    recordedAt: new Date().toISOString().slice(0, 10),
    combos,
};
writeFileSync(join(here, '..', 'src', 'samples.json'), JSON.stringify(out, null, 4) + '\n');
console.log('src/samples.json을 녹화본으로 바꿨습니다');
