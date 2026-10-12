import type { LogEntry } from './schema';

export type Bugs = {
    permission: boolean;
    doublePay: boolean;
    shareLabel: boolean;
};

export const VIEWER_ID = 'u-dohyun';
export const CONTENT_ID = 'c-42';
export const OWNER_ID = 'u-seoyeon';
const PRICE = 300;
const LATENCY_MS = 120;

type Body = LogEntry['body'];
type Method = LogEntry['method'];

export type FakeServer = {
    bugs: Bugs;
    reset: () => void;
    request: (method: Method, path: string, payload?: Record<string, string>) => Promise<LogEntry>;
    getLog: () => readonly LogEntry[];
    subscribe: (listener: () => void) => () => void;
};

export const createFakeServer = (bugs: Bugs): FakeServer => {
    let log: LogEntry[] = [];
    let seq = 0;
    let state = { title: '달빛 정원의 비밀', balance: 1000, purchased: false };
    const listeners = new Set<() => void>();
    const emit = () => listeners.forEach((l) => l());

    const handle = (method: Method, path: string, payload?: Record<string, string>): { status: number; body: Body } => {
        if (method === 'GET' && path === `/contents/${CONTENT_ID}`) {
            return {
                status: 200,
                body: {
                    id: CONTENT_ID,
                    title: state.title,
                    authorName: '서연',
                    ownerId: OWNER_ID,
                    price: PRICE,
                    canEdit: bugs.permission,
                },
            };
        }
        if (method === 'GET' && path === '/me') {
            return { status: 200, body: { id: VIEWER_ID, balance: state.balance, purchased: state.purchased } };
        }
        if (method === 'PATCH' && path === `/contents/${CONTENT_ID}`) {
            if (!bugs.permission) return { status: 403, body: { error: 'FORBIDDEN', message: '소유자만 수정할 수 있습니다' } };
            state = { ...state, title: payload?.title ?? state.title };
            return { status: 200, body: { id: CONTENT_ID, title: state.title, updatedBy: VIEWER_ID } };
        }
        if (method === 'POST' && path === `/contents/${CONTENT_ID}/purchase`) {
            if (state.purchased && !bugs.doublePay) return { status: 409, body: { error: 'ALREADY_PURCHASED' } };
            if (state.balance < PRICE) return { status: 402, body: { error: 'INSUFFICIENT_BALANCE' } };
            state = { ...state, balance: state.balance - PRICE, purchased: true };
            return { status: 200, body: { purchased: true, charged: PRICE, balance: state.balance } };
        }
        return { status: 404, body: { error: 'NOT_FOUND' } };
    };

    return {
        bugs,
        reset: () => {
            log = [];
            seq = 0;
            state = { title: '달빛 정원의 비밀', balance: 1000, purchased: false };
            emit();
        },
        // 응답을 요청 시점에 동기로 기록해야 연타 순서와 로그 id가 매번 같다
        request: (method, path, payload) => {
            seq += 1;
            const { status, body } = handle(method, path, payload);
            const entry: LogEntry = { id: `log#${seq}`, method, path, status, body };
            log = [...log, entry];
            emit();
            return new Promise((resolve) => setTimeout(() => resolve(entry), LATENCY_MS));
        },
        getLog: () => log,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
};

export const serializeEntry = (entry: LogEntry): string => `${entry.status} ${JSON.stringify(entry.body)}`;

export const comboKey = (bugs: Bugs): string =>
    `${bugs.permission ? 1 : 0}${bugs.doublePay ? 1 : 0}${bugs.shareLabel ? 1 : 0}`;
