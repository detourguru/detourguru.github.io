export type Message = {
    id: string; // 서버가 붙인 chatId
    savedAt: number; // 저장 시각. 밀리초까지만 있다
    time: string;
    speaker: string;
    text: string;
};

// 한 플레이어에게 저장된 메시지. 두 번째와 세 번째는 같은 밀리초에 저장됐다
export const MESSAGES: Message[] = [
    { id: 'm1', savedAt: 5120, time: '12:00:05.120', speaker: '플레이어 A', text: '안녕하세요' },
    { id: 'm2', savedAt: 5348, time: '12:00:05.348', speaker: '플레이어 A', text: '고블린 나왔어요' },
    { id: 'm3', savedAt: 5348, time: '12:00:05.348', speaker: '플레이어 B', text: '같이 잡아요' },
    { id: 'm4', savedAt: 6902, time: '12:00:06.902', speaker: '플레이어 A', text: '잡았다' },
];

// 소켓이 끊기기 전에 채팅에 넣은 메시지. 마지막 것이 다시 연결할 때 보내는 기준이다
export const RECEIVED_IDS = ['m1', 'm2'];
export const LAST_RECEIVED_ID = RECEIVED_IDS[RECEIVED_IDS.length - 1];
