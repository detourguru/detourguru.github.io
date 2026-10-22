import { useState } from 'react';

import { voteCasting, type Casting } from './consensus';
import { ROLES, SINGLE_RUNS, SLOTS, TRIALS, type Board } from './samples';

type Mode = 'single' | 'vote';
type VoteResult = ReturnType<typeof voteCasting>;
type Cell = { text?: string; notes?: string[]; tone?: 'bad' | 'warn' | 'saved' };
type Guide = { text: string; detail: string; tone: 'good' | 'bad' };

const THRESHOLD = 2;

const sameActors = (a: string[], b: string[]) => [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
const extraRoles = (casting: Casting) => Object.keys(casting).filter((role) => !ROLES.includes(role));
const wrongRoles = (casting: Casting, row: number) =>
    ROLES.map((role) => !casting[role] || !sameActors(casting[role], SLOTS[row].truth[role]));

// 배역 칸 넷과 그 외 배역 칸 하나씩, 정답과 다르면 빨간 점이 된다
const errorDots = (board: Board) => board.flatMap((casting, row) => [...wrongRoles(casting, row), extraRoles(casting).length > 0]);
const countErrors = (board: Board) =>
    board.reduce((sum, casting, row) => sum + wrongRoles(casting, row).filter(Boolean).length + extraRoles(casting).length, 0);
const average = (values: number[]) => (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);

const VOTES: VoteResult[][] = TRIALS.map((runs) =>
    SLOTS.map((_, row) =>
        voteCasting(
            runs.map((board) => board[row]),
            THRESHOLD,
        ),
    ),
);
const SINGLE_ERRORS = SINGLE_RUNS.map(countErrors);
const TRIAL_ERRORS = TRIALS.map((runs) => runs.map(countErrors));
const VOTE_ERRORS = VOTES.map((results) => countErrors(results.map(({ casting }) => casting)));
const PERFECT_SINGLE = SINGLE_ERRORS.filter((errors) => errors === 0).length;

const singleRoleCell = (casting: Casting, row: number, role: string): Cell => {
    const actors = casting[role];
    const truth = SLOTS[row].truth[role];
    if (!actors) return { text: '빠짐', tone: 'warn' };
    if (sameActors(actors, truth)) return { text: actors.join(', ') };
    return { text: actors.join(', '), notes: [`정답 ${truth.join(', ')}`], tone: 'bad' };
};

const singleExtraCell = (casting: Casting): Cell => {
    const extras = extraRoles(casting);
    if (extras.length === 0) return {};
    return { text: extras.map((role) => `${role} ${casting[role].join(', ')}`).join(' / '), notes: ['표에 없는 배역'], tone: 'bad' };
};

// 확정된 값과 다르게 읽은 응답을 "응답 2: A"처럼 적는다
const dissents = (runs: Board[], row: number, role: string, actors: string[] | undefined, prefix = '') =>
    runs.flatMap((board, index) => {
        const read = board[row][role];
        if (actors && read && sameActors(read, actors)) return [];
        if (!read) return actors ? [`응답 ${index + 1}: 없음`] : [];
        return [`응답 ${index + 1}: ${prefix}${read.join(', ')}`];
    });

const voteRoleCell = (result: VoteResult, runs: Board[], row: number, role: string): Cell => {
    const actors = result.casting[role];
    const truth = SLOTS[row].truth[role];
    const count = result.best[role]?.count ?? 0;
    if (!actors) return { text: '비움', notes: [`최다 ${count}표`], tone: 'warn' };
    if (!sameActors(actors, truth)) return { text: actors.join(', '), notes: [`정답 ${truth.join(', ')} · ${count}표`], tone: 'bad' };
    // 세 응답 중 하나가 다르게 읽었지만 2표로 정답이 확정된 칸
    if (count < runs.length) return { text: actors.join(', '), notes: [`${count}표`, ...dissents(runs, row, role, actors)], tone: 'saved' };
    return { text: actors.join(', ') };
};

const voteExtraCell = (result: VoteResult, runs: Board[], row: number): Cell => {
    const confirmed = extraRoles(result.casting);
    if (confirmed.length > 0) {
        return { text: confirmed.map((role) => `${role} ${result.casting[role].join(', ')}`).join(' / '), notes: ['표에 없는 배역'], tone: 'bad' };
    }
    const dropped = result.unsureRoles.filter((role) => !ROLES.includes(role));
    if (dropped.length > 0) {
        return {
            notes: dropped.flatMap((role) => [`${result.best[role]?.count ?? 0}표라 버림`, ...dissents(runs, row, role, undefined, `${role} `)]),
            tone: 'saved',
        };
    }
    return {};
};

// 열 밀림으로 들어온 배우가 원래 어느 배역 배우인지 찾는다
const findShift = (board: Board) => {
    for (const [row, casting] of board.entries()) {
        const { label, truth } = SLOTS[row];
        for (const role of ROLES) {
            const actors = casting[role];
            if (!actors || sameActors(actors, truth[role])) continue;
            const from = ROLES.find((other) => other !== role && sameActors(truth[other], actors));
            if (from) return { label, role, actor: actors.join(', '), from };
        }
    }
    return null;
};

const singleGuide = (index: number): Guide => {
    const errors = SINGLE_ERRORS[index];
    if (errors === 0) {
        return {
            text: '이 요청은 정답과 같다.',
            detail: `10번 중 ${PERFECT_SINGLE}번만 정답과 같았다. 같은 이미지를 다시 보내도 또 맞는다는 보장은 없다.`,
            tone: 'good',
        };
    }
    const shifted = findShift(SINGLE_RUNS[index]);
    return {
        text: `이 요청은 ${errors}칸을 틀렸다. 다수결이 없으면 이 값이 그대로 저장된다.`,
        detail: shifted
            ? `${shifted.label} ${shifted.role} 칸의 ${shifted.actor}는 바로 옆 ${shifted.from} 열의 배우라서 이름만 봐서는 이상하지 않다. 원본과 한 줄씩 대조해야 보인다.`
            : 'Unnamed는 표에 없는 배역이다. 검수 화면에서는 빈 칸처럼 보여서 헷갈린다.',
        tone: 'bad',
    };
};

const voteGuide = (index: number): Guide => {
    const counts = TRIAL_ERRORS[index].join(', ');
    const errors = VOTE_ERRORS[index];
    if (errors === 0) {
        return {
            text: `세 응답이 각각 ${counts}칸을 틀렸는데 다수결 결과는 정답과 같다.`,
            detail: '틀린 칸이 응답마다 달라서 틀린 값은 1표밖에 못 얻었다. 초록 글씨가 적힌 칸이 그렇게 걸러진 곳이다.',
            tone: 'good',
        };
    }
    return {
        text: `세 응답이 각각 ${counts}칸을 틀렸고, 다수결 뒤에도 ${errors}칸이 틀린 채로 남았다.`,
        detail: '두 응답이 같은 칸을 같은 값으로 틀리면 틀린 값이 2표를 얻어서 다수결도 그 값을 확정한다.',
        tone: 'bad',
    };
};

const MiniMap = ({ board }: { board: Board }) => (
    <span className="minimap" aria-hidden="true">
        {errorDots(board).map((bad, index) => (
            <i key={index} className={bad ? 'is-bad' : undefined} />
        ))}
    </span>
);

const CellView = ({ cell }: { cell: Cell }) => (
    <>
        {cell.text ? <b>{cell.text}</b> : !cell.notes && <span className="muted">-</span>}
        {cell.notes?.map((note) => (
            <span key={note} className="note">
                {note}
            </span>
        ))}
    </>
);

export const App = () => {
    const [mode, setMode] = useState<Mode>('single');
    const [singleIndex, setSingleIndex] = useState(0);
    const [trialIndex, setTrialIndex] = useState(0);

    const runs = TRIALS[trialIndex];
    const rows = SLOTS.map((slot, row) => {
        if (mode === 'single') {
            const casting = SINGLE_RUNS[singleIndex][row];
            return { slot, cells: [...ROLES.map((role) => singleRoleCell(casting, row, role)), singleExtraCell(casting)] };
        }
        const result = VOTES[trialIndex][row];
        return { slot, cells: [...ROLES.map((role) => voteRoleCell(result, runs, row, role)), voteExtraCell(result, runs, row)] };
    });
    const guide = mode === 'single' ? singleGuide(singleIndex) : voteGuide(trialIndex);

    return (
        <main className="page">
            <div className="title">
                <h1>같은 캐스팅보드 다시 읽히기</h1>
            </div>
            <p className="desc">같은 이미지와 프롬프트로 캐스팅보드를 여러 번 읽혔다. 빨간색이 정답과 다르게 읽은 칸이다.</p>

            <div className="controls mode-controls">
                <div className="switch" role="group" aria-label="보내는 방법">
                    <button type="button" aria-pressed={mode === 'single'} onClick={() => setMode('single')}>
                        한 번만 보내기
                    </button>
                    <button type="button" aria-pressed={mode === 'vote'} onClick={() => setMode('vote')}>
                        세 번 보내 다수결
                    </button>
                </div>
            </div>

            {mode === 'single' ? (
                <section className="runs" aria-label="요청 10번">
                    <div className="runs-head">
                        <span>같은 이미지를 10번 보냈을 때 틀린 칸</span>
                        <span className="runs-stat">
                            평균 <b>{average(SINGLE_ERRORS)}칸</b> · 정답과 같은 요청{' '}
                            <b>
                                {PERFECT_SINGLE}/{SINGLE_RUNS.length}
                            </b>
                        </span>
                    </div>
                    <div className="strip">
                        {SINGLE_RUNS.map((board, index) => (
                            <button
                                key={index}
                                type="button"
                                className="run"
                                aria-pressed={index === singleIndex}
                                aria-label={`요청 ${index + 1}, ${SINGLE_ERRORS[index]}칸 틀림`}
                                onClick={() => setSingleIndex(index)}
                            >
                                <MiniMap board={board} />
                                <span className="run-label">요청 {index + 1}</span>
                                <span className={`run-count${SINGLE_ERRORS[index] > 0 ? ' bad' : ''}`}>{SINGLE_ERRORS[index]}칸</span>
                            </button>
                        ))}
                    </div>
                </section>
            ) : (
                <section className="runs" aria-label="세 번씩 보낸 시행 5번">
                    <div className="runs-head">
                        <div className="switch" role="group" aria-label="시행 고르기">
                            {TRIALS.map((_, index) => (
                                <button key={index} type="button" aria-pressed={index === trialIndex} onClick={() => setTrialIndex(index)}>
                                    시행 {index + 1}
                                </button>
                            ))}
                        </div>
                        <span className="runs-stat">
                            요청 하나당 평균 <b>{average(TRIAL_ERRORS.flat())}칸</b> → 다수결 뒤 <b>{average(VOTE_ERRORS)}칸</b>
                        </span>
                    </div>
                    <div className="flow">
                        {TRIALS[trialIndex].map((board, index) => (
                            <div key={index} className="run is-static">
                                <MiniMap board={board} />
                                <span className="run-label">응답 {index + 1}</span>
                                <span className={`run-count${TRIAL_ERRORS[trialIndex][index] > 0 ? ' bad' : ''}`}>
                                    {TRIAL_ERRORS[trialIndex][index]}칸
                                </span>
                            </div>
                        ))}
                        <span className="flow-arrow" aria-hidden="true">
                            →
                        </span>
                        <div className="run is-static is-result">
                            <MiniMap board={VOTES[trialIndex].map(({ casting }) => casting)} />
                            <span className="run-label">다수결</span>
                            <span className={`run-count${VOTE_ERRORS[trialIndex] > 0 ? ' bad' : ''}`}>{VOTE_ERRORS[trialIndex]}칸</span>
                        </div>
                    </div>
                </section>
            )}

            <p aria-live="polite" className={`guide guide-${guide.tone}`}>
                {guide.text}
                <span className="guide-detail">{guide.detail}</span>
            </p>

            <div className="screen table-scroll">
                <table className="board">
                    <caption>
                        {mode === 'single' ? `요청 ${singleIndex + 1}에서 저장되는 값` : `시행 ${trialIndex + 1}에서 다수결로 저장되는 값`}
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">회차</th>
                            {ROLES.map((role) => (
                                <th key={role} scope="col">
                                    {role}
                                </th>
                            ))}
                            <th scope="col" className="extra-col">
                                그 외 배역
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ slot, cells }) => (
                            <tr key={slot.label}>
                                <th scope="row">{slot.label}</th>
                                {cells.map((cell, index) => (
                                    <td
                                        key={index}
                                        className={[index === ROLES.length && 'extra-col', cell.tone && `is-${cell.tone}`].filter(Boolean).join(' ') || undefined}
                                    >
                                        <CellView cell={cell} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="footnote">
                틀린 칸 수는 글에 적은 측정값에 맞췄고, 회차와 배우, 어느 칸이 어떻게 틀렸는지는 글의 오류 유형으로 만든 예시입니다. 다수결 계산은 회전문 코드를 옮겨 이 화면에서 실행합니다.
            </p>
        </main>
    );
};
