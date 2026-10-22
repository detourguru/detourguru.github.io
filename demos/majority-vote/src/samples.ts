import type { Casting } from './consensus';

export const ROLES = ['래리 머피', '신시아 머피', '재러드', '알라나'];

export type Slot = { label: string; truth: Casting };

// 배우 이름은 글처럼 알파벳으로 바꿨다. 래리 머피는 A·B, 신시아 머피는 C·D, 재러드는 E·F, 알라나는 G·H가 번갈아 나온다
const TRUTH_ROWS: [string, string[]][] = [
    ['11/3 화 19:30', ['A', 'C', 'E', 'G']],
    ['11/4 수 19:30', ['B', 'D', 'F', 'H']],
    ['11/5 목 19:30', ['A', 'D', 'E', 'H']],
    ['11/6 금 19:30', ['B', 'C', 'F', 'G']],
    ['11/7 토 14:00', ['A', 'C', 'F', 'H']],
    ['11/7 토 18:30', ['B', 'D', 'E', 'G']],
    ['11/8 일 14:00', ['A', 'D', 'F', 'G']],
    ['11/8 일 18:30', ['B', 'C', 'E', 'H']],
];

export const SLOTS: Slot[] = TRUTH_ROWS.map(([label, actors]) => ({
    label,
    truth: Object.fromEntries(ROLES.map((role, index) => [role, [actors[index]]])),
}));

// 응답 하나에서 틀린 곳
// shift: row번째 회차를 읽다가 from번째 배역 칸부터 왼쪽 배역의 배우가 한 칸씩 밀려 들어왔다(열 밀림)
// ghost: row번째 회차에 표에 없는 Unnamed 배역이 생겼다(유령 배역)
type Slip = { row: number; shift: number } | { row: number; ghost: string };

const shift = (row: number, from: number): Slip => ({ row, shift: from });
const ghost = (row: number, actor: string): Slip => ({ row, ghost: actor });

export type Board = Casting[];

const read = (...slips: Slip[]): Board =>
    SLOTS.map(({ truth }, row) => {
        const casting: Casting = Object.fromEntries(ROLES.map((role) => [role, [...truth[role]]]));

        for (const slip of slips) {
            if (slip.row !== row) continue;
            if ('shift' in slip) {
                for (let index = slip.shift; index < ROLES.length; index += 1) casting[ROLES[index]] = [...truth[ROLES[index - 1]]];
            } else {
                casting.Unnamed = [slip.ghost];
            }
        }

        return casting;
    });

// 한 번만 보낸 요청 10번. 틀린 칸 수는 글의 측정값 6, 0, 2, 2, 0, 0, 2, 7, 0, 4에 맞췄다
export const SINGLE_RUNS: Board[] = [
    read(shift(1, 1), shift(5, 2), ghost(7, 'H')),
    read(),
    read(shift(3, 2)),
    read(shift(0, 3), ghost(6, 'G')),
    read(),
    read(),
    read(shift(2, 3), shift(7, 3)),
    read(shift(0, 1), shift(4, 1), ghost(6, 'F')),
    read(),
    read(shift(2, 2), shift(5, 3), ghost(3, 'G')),
];

// 세 번씩 보낸 시행 5번. 요청별 틀린 칸 수는 글의 표(0·3·2, 0·0·2, 2·4·5, 0·5·0, 0·5·2)에 맞췄다
// 3번째 시행만 두 응답이 같은 회차를 같은 모양으로 밀려 읽어서 다수결 뒤에도 2칸이 틀린다
export const TRIALS: Board[][] = [
    [read(), read(shift(2, 1)), read(shift(6, 2))],
    [read(), read(), read(shift(4, 3), ghost(7, 'H'))],
    [read(shift(3, 2)), read(shift(3, 2), shift(6, 3), ghost(1, 'H')), read(shift(0, 1), shift(5, 2))],
    [read(), read(shift(1, 1), shift(7, 2)), read()],
    [read(), read(shift(5, 1), shift(2, 2)), read(ghost(0, 'G'), shift(3, 3))],
];
