import { expectAbsent, runLocator, type Locator } from './dom';
import { CONTENT_ID, OWNER_ID, VIEWER_ID, type FakeServer } from './fakeServer';
import type { Judgement } from './judgement';
import type { EvidenceJson, LocatorResult, LogEntry, Step } from './schema';
import type { TargetController } from './targetApp/controller';

export type StepView = {
    id: string;
    title: string;
    status: 'running' | 'done';
    note: string;
    helper?: Judgement;
};

type Options = {
    getRoot: () => HTMLElement | null;
    server: FakeServer;
    app: TargetController;
    signal: AbortSignal;
    stepDelay: number;
    onProgress: (steps: StepView[]) => void;
};

const HIGHLIGHT = 'data-qa-highlight';

const wait = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (signal.aborted) return reject(signal.reason);
        const t = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(t);
            reject(signal.reason);
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });

const highlight = (root: Element, elements: Element[]) => {
    root.querySelectorAll(`[${HIGHLIGHT}]`).forEach((el) => el.removeAttribute(HIGHLIGHT));
    elements.forEach((el) => el.setAttribute(HIGHLIGHT, ''));
};

export const clearHighlight = (root: Element | null) => root && highlight(root, []);

export const runDohyunJourney = async (opts: Options): Promise<{ evidence: EvidenceJson; views: StepView[] }> => {
    const { server, app, signal } = opts;
    const steps: Step[] = [];
    const views: StepView[] = [];

    server.reset();
    app.reset();

    const root = (): HTMLElement => {
        const el = opts.getRoot();
        if (!el) throw new Error('앱 화면 컨테이너가 없습니다');
        return el;
    };
    const newLogsSince = (from: number): LogEntry[] => server.getLog().slice(from);

    const step = async (
        title: string,
        body: () => Promise<{ locators?: LocatorResult[]; logIds?: string[]; note: string; target?: string; helper?: Judgement; found?: Element[] }>,
    ) => {
        const id = `step#${steps.length + 1}`;
        const view: StepView = { id, title, status: 'running', note: '' };
        views.push(view);
        opts.onProgress([...views]);
        const r = await body();
        steps.push({ id, title, target: r.target, locators: r.locators ?? [], logIds: r.logIds ?? [], note: r.note });
        highlight(root(), r.found ?? []);
        views[views.length - 1] = { ...view, status: 'done', note: r.note, helper: r.helper };
        opts.onProgress([...views]);
        await wait(opts.stepDelay, signal);
    };
    const frame = () => wait(30, signal);

    let contentLog: LogEntry | undefined;

    await step('상세 화면 열기 (남의 콘텐츠)', async () => {
        const from = server.getLog().length;
        await app.open();
        await frame();
        const logs = newLogsSince(from);
        contentLog = logs.find((l) => l.path === `/contents/${CONTENT_ID}`);
        const heading = runLocator(root(), { role: 'heading', name: /.+/ });
        return {
            locators: [heading.result],
            logIds: logs.map((l) => l.id),
            found: heading.elements,
            note: `콘텐츠 주인 ${OWNER_ID}, 보는 사람 ${VIEWER_ID}`,
        };
    });

    await step('편집 진입점 찾기: expectAbsent, 로케이터 2개', async () => {
        const name = /^\s*(수정|편집|삭제)/;
        const locators: Locator[] = [
            { role: 'button', name },
            { role: 'link', name },
        ];
        const res = expectAbsent({
            id: 'helper-edit',
            label: '남의 콘텐츠 상세의 편집, 삭제 진입점',
            root: root(),
            locators,
            evidence: contentLog ? [{ kind: 'log', id: contentLog.id, quote: `"ownerId":"${OWNER_ID}"` }] : undefined,
        });
        return {
            target: 'edit',
            locators: res.results,
            found: res.found,
            helper: res.judgement,
            note: res.absent ? '로케이터 2개 모두 일치 0개' : `찾음: ${res.results.filter((r) => r.matches > 0).map((r) => r.observed).join(', ')}`,
        };
    });

    await step('비소유자로 PATCH 직접 보내기', async () => {
        const entry = await server.request('PATCH', `/contents/${CONTENT_ID}`, { title: '도현이 바꾼 제목' });
        return { logIds: [entry.id], note: `PATCH 응답 ${entry.status}` };
    });

    await step('구매 버튼 빠르게 두 번 누르기', async () => {
        const from = server.getLog().length;
        const buy = runLocator(root(), { role: 'button', name: '구매' });
        const target = buy.elements[0];
        if (target instanceof HTMLElement) {
            target.click();
            target.click();
        }
        await app.settled();
        await frame();
        const posts = newLogsSince(from);
        return {
            target: 'purchase',
            locators: [buy.result],
            logIds: posts.map((l) => l.id),
            found: buy.elements,
            note: target ? `클릭 2회, 구매 요청 ${posts.length}건 전송` : '구매 버튼을 못 찾아 클릭하지 못함',
        };
    });

    await step('잔액 확인 (화면 + 서버)', async () => {
        const me = await server.request('GET', '/me');
        await frame();
        const bar = root().querySelector('.target-bar');
        const shown = bar?.textContent?.match(/잔액\s*([\d,]+)P/)?.[1] ?? '?';
        const purchases = server.getLog().filter((l) => l.method === 'POST' && l.path.endsWith('/purchase'));
        const ok = purchases.filter((l) => l.status === 200).length;
        return {
            logIds: [me.id],
            note: `화면 잔액 ${shown}P, 서버 잔액 ${String(me.body.balance)}P, 구매 요청 ${purchases.length}건 중 200 응답 ${ok}건`,
        };
    });

    await step('공유 찾기: 로케이터 1개, 버튼 이름 "공유"', async () => {
        const naive = runLocator(root(), { role: 'button', name: '공유' });
        return { target: 'share', locators: [naive.result], found: naive.elements, note: naive.result.observed };
    });

    await step('공유 찾기: expectAbsent, 버튼과 링크 로케이터 2개', async () => {
        const name = /공유/;
        const res = expectAbsent({
            id: 'helper-share',
            label: '상세 화면의 공유 진입점',
            root: root(),
            locators: [
                { role: 'button', name },
                { role: 'link', name },
            ],
        });
        return {
            target: 'share',
            locators: res.results,
            found: res.found,
            helper: res.judgement,
            note: res.absent ? '로케이터 2개 모두 일치 0개' : `찾음: ${res.results.filter((r) => r.matches > 0).map((r) => `${r.selector}: ${r.observed}`).join(', ')}`,
        };
    });

    const evidence: EvidenceJson = {
        persona: '도현',
        viewer: { id: VIEWER_ID },
        content: { id: CONTENT_ID, ownerId: OWNER_ID },
        steps,
        log: [...server.getLog()],
    };
    return { evidence, views };
};
