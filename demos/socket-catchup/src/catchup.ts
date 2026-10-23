import type { Message } from './samples';

export type Mode = 'gt' | 'gte' | 'gte-filter';

export type AfterRow =
    | { kind: 'resent'; message: Message } // 놓쳤다가 다시 받은 메시지
    | { kind: 'twice'; message: Message } // 이미 있는데 한 번 더 찍힌 메시지
    | { kind: 'missing'; message: Message }; // 놓쳤는데 다시 받지도 못한 메시지

// 백엔드: 기준 메시지가 저장된 시각을 찾고 그 시각과 비교해서 묶음에 담을 메시지를 고른다
export const queryCatchup = (messages: Message[], lastId: string, inclusive: boolean): Message[] => {
    const anchor = messages.find((message) => message.id === lastId);
    if (!anchor) return messages;
    return messages.filter((message) => (inclusive ? message.savedAt >= anchor.savedAt : message.savedAt > anchor.savedAt));
};

// 다시 연결한 뒤 채팅에 붙는 줄. filter가 켜져 있으면 addChats처럼 이미 들고 있는 id는 넣지 않는다
export const reconnect = (messages: Message[], receivedIds: string[], lastId: string, mode: Mode) => {
    const response = queryCatchup(messages, lastId, mode !== 'gt');
    const inResponse = new Set(response.map((message) => message.id));
    const received = new Set(receivedIds);
    const filter = mode === 'gte-filter';

    const rows: AfterRow[] = [];
    const filtered: Message[] = [];
    for (const message of messages) {
        if (inResponse.has(message.id)) {
            if (!received.has(message.id)) rows.push({ kind: 'resent', message });
            else if (filter) filtered.push(message);
            else rows.push({ kind: 'twice', message });
        } else if (!received.has(message.id)) {
            rows.push({ kind: 'missing', message });
        }
    }

    return { inResponse, rows, filtered };
};
