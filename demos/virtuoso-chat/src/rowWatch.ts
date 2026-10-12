const HISTORY_MS = 4000;
const ROW_SELECTOR = '[data-msg-row]';

type Sample = { at: number; height: number };
type Remount = { id: string; at: number };

export type RowChange = {
    id: string;
    kind: string;
    snippet: string;
    from: number;
    to: number;
    remounted: boolean;
    replayedEntry: boolean;
};

export type RowWatcher = {
    biggestChangeSince: (since: number, remountedOnly: boolean) => RowChange | null;
    disconnect: () => void;
};

const KIND_LABEL: Record<string, string> = { image: '사진', choices: '선택지', stream: '스트리밍', text: '메시지' };

const snippetOf = (row: HTMLElement) => {
    const text = row.querySelector('.text')?.textContent?.trim() ?? '';
    if (!text) return KIND_LABEL[row.dataset.msgKind ?? ''] ?? '메시지';
    return text.length > 12 ? `${text.slice(0, 12)}…` : text;
};

const collectRows = (node: Node): HTMLElement[] => {
    if (!(node instanceof HTMLElement)) return [];
    const rows = Array.from(node.querySelectorAll<HTMLElement>(ROW_SELECTOR));
    return node.matches(ROW_SELECTOR) ? [node, ...rows] : rows;
};

export const watchRows = (scroller: HTMLElement): RowWatcher => {
    const seenIds = new Set<string>();
    const history = new Map<string, Sample[]>();
    const remounts: Remount[] = [];
    const rowsById = new Map<string, HTMLElement>();
    const metaById = new Map<string, { kind: string; snippet: string }>();

    const record = (id: string, height: number, at: number) => {
        const samples = (history.get(id) ?? []).filter((s) => at - s.at < HISTORY_MS);
        samples.push({ at, height });
        history.set(id, samples);
    };

    const resizeObserver = new ResizeObserver((entries) => {
        const now = performance.now();
        for (const entry of entries) {
            const row = entry.target as HTMLElement;
            const id = row.dataset.msgId;
            if (!id) continue;
            record(id, Math.round(entry.borderBoxSize[0]?.blockSize ?? row.offsetHeight), now);
        }
    });

    const addRow = (row: HTMLElement, now: number, initial: boolean) => {
        const id = row.dataset.msgId;
        if (!id || rowsById.get(id) === row) return;
        if (!initial && seenIds.has(id)) remounts.push({ id, at: now });
        seenIds.add(id);
        rowsById.set(id, row);
        metaById.set(id, { kind: row.dataset.msgKind ?? 'text', snippet: snippetOf(row) });
        resizeObserver.observe(row);
    };

    for (const row of collectRows(scroller)) addRow(row, performance.now(), true);

    const mutationObserver = new MutationObserver((mutations) => {
        const now = performance.now();
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                for (const row of collectRows(node)) {
                    resizeObserver.unobserve(row);
                    const id = row.dataset.msgId;
                    if (id && rowsById.get(id) === row) rowsById.delete(id);
                }
            }
            for (const node of mutation.addedNodes) for (const row of collectRows(node)) addRow(row, now, false);
        }
        while (remounts.length && now - remounts[0].at > HISTORY_MS) remounts.shift();
    });
    mutationObserver.observe(scroller, { childList: true, subtree: true });

    const changeOf = (id: string, since: number, remounted: boolean): RowChange | null => {
        const samples = (history.get(id) ?? []).filter((s) => s.at >= since);
        if (samples.length < 2) return null;
        const heights = samples.map((s) => s.height);
        const from = Math.min(...heights);
        const to = samples[samples.length - 1].height;
        if (to === from) return null;
        const row = rowsById.get(id);
        const meta = metaById.get(id) ?? { kind: 'text', snippet: '메시지' };
        return {
            id,
            kind: meta.kind,
            snippet: row ? snippetOf(row) : meta.snippet,
            from,
            to,
            remounted,
            replayedEntry: remounted && Boolean(row?.querySelector('.enter-grow')),
        };
    };

    return {
        biggestChangeSince: (since, remountedOnly) => {
            const remountedIds = new Set(remounts.filter((r) => r.at >= since).map((r) => r.id));
            const ids = remountedOnly ? [...remountedIds] : [...history.keys()];
            let best: RowChange | null = null;
            for (const id of ids) {
                const change = changeOf(id, since, remountedIds.has(id));
                if (change && (!best || Math.abs(change.to - change.from) > Math.abs(best.to - best.from))) best = change;
            }
            return best;
        },
        disconnect: () => {
            mutationObserver.disconnect();
            resizeObserver.disconnect();
        },
    };
};

const GROWTH_REASON: Record<string, string> = {
    image: '이미지가 늦게 로드돼',
    choices: '선택지 버튼이 늦게 붙어',
    stream: '스트리밍 텍스트가 늘어나',
    text: '등장 애니메이션으로',
};

export const describeMissCause = (change: RowChange | null) => {
    if (!change) return '원인: 렌더 뒤에 메시지 높이가 바뀜';
    const reason = GROWTH_REASON[change.kind] ?? GROWTH_REASON.text;
    return `원인: 메시지가 붙은 뒤 ${reason} 높이가 ${change.from}px에서 ${change.to}px로 커짐`;
};

export const describeShakeCause = (change: RowChange | null) => {
    if (!change) return '원인: 렌더 뒤에 메시지 높이가 바뀜';
    if (!change.remounted) return `원인: ‘${change.snippet}’ 메시지 높이가 렌더 뒤 ${change.from}px에서 ${change.to}px로 바뀜`;
    const replay = change.replayedEntry ? ' 등장 애니메이션이 처음부터 재생돼' : '';
    return `원인: 화면 밖으로 나갔던 ‘${change.snippet}’ 메시지가 다시 그려지면서${replay} 높이가 ${change.from}px에서 ${change.to}px로 다시 측정됨`;
};
