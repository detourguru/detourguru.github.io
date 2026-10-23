import type { Lang } from '../../shared/lang';
import { LANG } from './text';

export type MessageKind = 'text' | 'image' | 'stream' | 'choices';

export type Message = {
    id: string;
    kind: MessageKind;
    mine: boolean;
    text: string;
    streaming: boolean;
    choices: string[];
};

export type Rng = () => number;

export const createRng = (seed: number): Rng => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

type Samples = {
    shortLines: readonly string[];
    longLines: readonly string[];
    streamText: string;
    choiceSets: readonly (readonly string[])[];
    imageText: string;
};

// 시드가 같은 메시지를 고르도록 두 언어의 배열 길이를 맞춘다
const SAMPLES: Record<Lang, Samples> = {
    ko: {
        shortLines: [
            '방금 들어왔어요',
            '오 이거 좋네요',
            'ㅋㅋㅋ 그러니까요',
            '잠깐만요, 확인해볼게요',
            '저도 같은 생각이에요',
            '네 알겠습니다!',
            '그거 어제 고친 거 아니었어요?',
            '지도 다시 열어볼게요',
        ],
        longLines: [
            '문 너머에서 낮은 목소리가 들린다. 누군가 이쪽을 지켜보고 있었던 것 같다. 발소리가 점점 가까워진다.',
            '상점 주인이 고개를 갸웃한다. "그 물건이라면 지난주에 다 팔렸는데요. 다음 배가 들어오면 다시 들여놓을게요."',
            '오늘 점검은 30분 정도 걸릴 예정이에요. 진행 중인 전투는 점검이 끝나면 그대로 이어서 할 수 있어요.',
            '복도 끝 창문이 덜컹거린다. 바람인지, 아니면 누가 밖에서 흔드는 건지 알 수 없다.',
        ],
        streamText:
            '좋아요, 지금 상황을 정리해 볼게요. 북쪽 다리는 무너졌고 남쪽 길은 경비가 지키고 있어요. 남은 길은 강을 따라 내려가는 것뿐인데, 밤이 되면 물살이 세져서 서둘러야 해요. 어느 쪽으로 갈지 정해 주세요.',
        choiceSets: [
            ['문을 연다', '숨는다', '말을 건다'],
            ['산다', '흥정한다'],
            ['강을 따라간다', '다리를 찾는다', '야영한다'],
        ],
        imageText: '사진을 보냈습니다',
    },
    en: {
        shortLines: [
            'Just got here',
            'Oh, this is nice',
            'lol exactly',
            'Hang on, let me check',
            'Same here',
            'Got it!',
            "Didn't we fix that yesterday?",
            "I'll open the map again",
        ],
        longLines: [
            'A low voice comes from behind the door. Someone seems to have been watching this way. The footsteps are getting closer.',
            'The shopkeeper tilts their head. "That item sold out last week. I\'ll restock it when the next ship comes in."',
            "Today's maintenance should take about 30 minutes. Any battle in progress will pick up right where it left off once it's over.",
            "The window at the end of the hall rattles. Hard to tell if it's the wind or someone shaking it from outside.",
        ],
        streamText:
            "All right, let me sum up where we are. The north bridge has collapsed and the south road is guarded. The only way left is down along the river, but the current gets stronger at night, so we need to hurry. Tell me which way to go.",
        choiceSets: [
            ['Open the door', 'Hide', 'Talk'],
            ['Buy', 'Haggle'],
            ['Follow the river', 'Look for a bridge', 'Make camp'],
        ],
        imageText: 'Sent a photo',
    },
};

const { shortLines: SHORT_LINES, longLines: LONG_LINES, streamText: STREAM_TEXT, choiceSets: CHOICE_SETS, imageText: IMAGE_TEXT } = SAMPLES[LANG];

export const STREAM_TOKENS = STREAM_TEXT.split(' ');

export type MessageFactory = {
    create: (kind: MessageKind) => Message;
};

export const createMessageFactory = (rng: Rng, idPrefix: string): MessageFactory => {
    let seq = 0;
    const create = (kind: MessageKind): Message => {
        seq += 1;
        const mine = kind === 'text' && rng() < 0.35;
        const base = {
            id: `${idPrefix}-${seq}`,
            kind,
            mine,
            streaming: false,
            choices: [] as string[],
        };
        switch (kind) {
            case 'text':
                return { ...base, text: rng() < 0.6 ? pick(rng, SHORT_LINES) : pick(rng, LONG_LINES) };
            case 'image':
                return { ...base, text: IMAGE_TEXT };
            case 'stream':
                return { ...base, text: '' };
            case 'choices':
                return { ...base, text: pick(rng, LONG_LINES), choices: [...pick(rng, CHOICE_SETS)] };
        }
    };
    return { create };
};

export const pickRandomKind = (rng: Rng): MessageKind => {
    const r = rng();
    if (r < 0.45) return 'text';
    if (r < 0.7) return 'image';
    if (r < 0.85) return 'choices';
    return 'stream';
};

export const SEED_COUNT = 60;

export const createSeedMessages = (): Message[] => {
    const rng = createRng(20260915);
    const factory = createMessageFactory(rng, 'seed');
    return Array.from({ length: SEED_COUNT }, () => {
        const message = factory.create(pickRandomKind(rng));
        return message.kind === 'stream' ? { ...message, text: STREAM_TEXT } : message;
    });
};
