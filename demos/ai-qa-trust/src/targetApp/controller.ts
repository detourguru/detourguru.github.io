import { CONTENT_ID, type FakeServer } from '../fakeServer';

export type AppState = {
    status: 'idle' | 'loading' | 'ready';
    title: string;
    authorName: string;
    price: number;
    canEdit: boolean;
    balance: number | null;
    purchaseMessage: string | null;
};

const INITIAL: AppState = {
    status: 'idle',
    title: '',
    authorName: '',
    price: 0,
    canEdit: false,
    balance: null,
    purchaseMessage: null,
};

export type TargetController = {
    getState: () => AppState;
    subscribe: (listener: () => void) => () => void;
    reset: () => void;
    open: () => Promise<void>;
    purchase: () => void;
    settled: () => Promise<void>;
};

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback);

// effect로 옮기면 StrictMode 이중 실행이 서버 로그를 늘려 샘플 지문이 어긋난다
export const createTargetController = (server: FakeServer): TargetController => {
    let state = INITIAL;
    let generation = 0;
    let purchaseLock = false;
    const inFlight = new Set<Promise<unknown>>();
    const listeners = new Set<() => void>();

    const set = (patch: Partial<AppState>) => {
        state = { ...state, ...patch };
        listeners.forEach((l) => l());
    };
    const track = <T>(p: Promise<T>): Promise<T> => {
        inFlight.add(p);
        void p.finally(() => inFlight.delete(p));
        return p;
    };

    return {
        getState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        reset: () => {
            generation += 1;
            purchaseLock = false;
            inFlight.clear();
            set(INITIAL);
        },
        open: async () => {
            const gen = generation;
            set({ status: 'loading' });
            const content = track(server.request('GET', `/contents/${CONTENT_ID}`));
            const me = track(server.request('GET', '/me'));
            const [c, m] = await Promise.all([content, me]);
            if (gen !== generation) return;
            set({
                status: 'ready',
                title: str(c.body.title),
                authorName: str(c.body.authorName),
                price: num(c.body.price),
                canEdit: c.body.canEdit === true,
                balance: num(m.body.balance),
            });
        },
        purchase: () => {
            if (!server.bugs.doublePay) {
                if (purchaseLock) return;
                purchaseLock = true;
            }
            const gen = generation;
            const req = track(server.request('POST', `/contents/${CONTENT_ID}/purchase`));
            void req.then((res) => {
                if (gen !== generation) return;
                purchaseLock = false;
                if (res.status === 200) set({ balance: num(res.body.balance), purchaseMessage: '구매 완료' });
                else set({ purchaseMessage: `구매 실패 (${res.status})` });
            });
        },
        settled: async () => {
            while (inFlight.size > 0) await Promise.all([...inFlight]);
        },
    };
};
