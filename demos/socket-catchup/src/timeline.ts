import { MESSAGES, type Message, RECEIVED_IDS } from './samples';

export type TimelineEvent =
    | { kind: 'connect' }
    | { kind: 'live'; message: Message } // 소켓으로 받아 채팅에 넣는다
    | { kind: 'cut' } // 앱이 백그라운드로 가서 소켓이 끊긴다. 그동안 온 메시지는 서버에 저장만 된다
    | { kind: 'foreground' } // 다시 연결하면서 마지막으로 받은 chatId를 보낸다
    | { kind: 'catchup' }; // 서버가 놓친 메시지를 묶음으로 보낸다

export const TIMELINE: TimelineEvent[] = [
    { kind: 'connect' },
    ...MESSAGES.filter((message) => RECEIVED_IDS.includes(message.id)).map((message): TimelineEvent => ({ kind: 'live', message })),
    { kind: 'cut' },
    { kind: 'foreground' },
    { kind: 'catchup' },
];

// 다음 일이 일어나기까지 기다리는 시간. 끊긴 다음에는 시간이 지난 것처럼 조금 더 기다린다
export const delayBefore = (next: TimelineEvent | undefined) => (next?.kind === 'connect' ? 500 : next?.kind === 'foreground' ? 1800 : 1100);
