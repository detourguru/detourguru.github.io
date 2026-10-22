import { useMemo, useState } from 'react';

import { combine, type Casting, type Outcome, type Vote } from './consensus';
import { ROLE_ORDER, SAMPLES, TRUTH } from './samples';

type Threshold = 2 | 3;

type Cell =
    | { status: 'ok' | 'wrong'; actors: string[]; votes?: number }
    | { status: 'blank' | 'filtered'; best: Vote | null }
    | { status: 'missing' | 'none' };

const ALL_ARRIVED = SAMPLES.map(() => true);

// 정답에 없는 배역(유령 배역, 오독한 배역명)도 행으로 보여준다
const ROLE_ROWS = [
    ...ROLE_ORDER,
    ...SAMPLES.flatMap(({ casting }) => Object.keys(casting)).filter(
        (role, index, all) => !ROLE_ORDER.includes(role) && all.indexOf(role) === index,
    ),
];

const sameActors = (a: string[], b: string[]) => [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

const isWrong = (casting: Casting, role: string) => {
    const actors = casting[role];
    const truth = TRUTH[role];
    if (actors && truth) return !sameActors(actors, truth);
    return Boolean(actors) !== Boolean(truth);
};

const confirmedCell = (actors: string[] | undefined, role: string, votes?: number): Cell => {
    const truth = TRUTH[role];
    if (!actors) return truth ? { status: 'missing' } : { status: 'none' };
    return { status: truth && sameActors(actors, truth) ? 'ok' : 'wrong', actors, votes };
};

const resultCell = (outcome: Outcome, role: string): Cell => {
    if (outcome.kind === 'failed') return { status: 'none' };
    if (outcome.kind === 'single') return confirmedCell(outcome.casting[role], role);

    if (outcome.casting[role]) return confirmedCell(outcome.casting[role], role, outcome.best[role]?.count);
    if (outcome.unsureRoles.includes(role)) {
        return { status: TRUTH[role] ? 'blank' : 'filtered', best: outcome.best[role] ?? null };
    }
    return confirmedCell(undefined, role);
};

const voteText = (best: Vote | null) => (best ? `${best.value.join(', ')} ${best.count}표` : '');

const CellView = ({ cell }: { cell: Cell }) => {
    switch (cell.status) {
        case 'ok':
        case 'wrong':
            return (
                <>
                    <b>{cell.actors.join(', ')}</b>
                    {cell.votes !== undefined && <span className="votes">{cell.votes}표</span>}
                </>
            );
        case 'blank':
            return (
                <>
                    <b>비움</b>
                    <span className="votes">{voteText(cell.best)}</span>
                </>
            );
        case 'filtered':
            return (
                <>
                    <b>걸러짐</b>
                    <span className="votes">{voteText(cell.best)}</span>
                </>
            );
        case 'missing':
            return <b>빠짐</b>;
        case 'none':
            return <span className="muted">-</span>;
    }
};

export const App = () => {
    const [threshold, setThreshold] = useState<Threshold>(2);
    const [arrived, setArrived] = useState<boolean[]>(ALL_ARRIVED);

    const outcome = useMemo(
        () =>
            combine(
                SAMPLES.flatMap(({ casting }, index) => (arrived[index] ? [{ index, casting }] : [])),
                threshold,
            ),
        [arrived, threshold],
    );
    const cells = ROLE_ROWS.map((role) => ({ role, cell: resultCell(outcome, role) }));
    const rolesWith = (...statuses: Cell['status'][]) =>
        cells.filter(({ cell }) => statuses.includes(cell.status)).map(({ role }) => role);
    const wrong = rolesWith('wrong');
    const empty = rolesWith('blank', 'missing');
    const filtered = rolesWith('filtered');
    const arrivedCount = arrived.filter(Boolean).length;
    const isDefault = threshold === 2 && arrived.every(Boolean);

    const toggleArrived = (index: number) => setArrived((prev) => prev.map((on, i) => (i === index ? !on : on)));

    const guide: { text: string; detail: string; tone: 'good' | 'bad' | 'warn' } =
        outcome.kind === 'failed'
            ? { text: '도착한 응답이 없으면 파싱이 실패로 끝납니다.', detail: '응답을 하나 이상 다시 켜 보세요.', tone: 'bad' }
            : outcome.kind === 'single'
              ? {
                    text: `${SAMPLES[outcome.index].label}만 도착해서 다수결 없이 그대로 씁니다.`,
                    detail:
                        wrong.length + empty.length > 0
                            ? `이 응답의 ${SAMPLES[outcome.index].error}도 그대로 결과에 남습니다.`
                            : '이 응답은 정답과 같아서 그대로 써도 틀리지 않았습니다.',
                    tone: wrong.length + empty.length > 0 ? 'bad' : 'good',
                }
              : wrong.length > 0
                ? {
                      text: `${wrong.join(', ')} 배역에 틀린 값이 확정됐습니다.`,
                      detail: `틀린 값이 ${outcome.threshold}표를 얻으면 다수결도 그 값을 확정합니다.`,
                      tone: 'bad',
                  }
                : empty.length > 0
                  ? {
                        text: `${empty.join(', ')} 배역은 ${outcome.threshold}표를 못 채워서 비워 뒀습니다.`,
                        detail:
                            arrivedCount === 2
                                ? '응답이 둘만 도착하면 둘이 같은 값을 낸 배역만 확정합니다. 이 배역은 사람이 원본과 대조해서 채워야 합니다.'
                                : '응답 하나만 달라도 확정하지 않으니 틀린 값은 막았지만, 맞는 배우까지 비었습니다.',
                        tone: 'warn',
                    }
                  : {
                        text: `정답과 같습니다. 응답마다 틀린 칸이 달라서 틀린 값은 ${outcome.threshold}표를 얻지 못했습니다.`,
                        detail:
                            threshold === 2 && arrivedCount === 3
                                ? '3/3 기준으로 바꾸거나, 도착한 응답에서 하나를 빼 보세요.'
                                : '기준이나 도착한 응답을 바꿔 보세요.',
                        tone: 'good',
                    };

    return (
        <main className="page">
            <div className="title">
                <h1>캐스팅 다수결</h1>
            </div>
            <p className="desc">같은 캐스팅보드를 세 번 읽힌 응답을 배역마다 다수결로 합친다. 기준과 도착한 응답을 바꾸면 결과가 바로 다시 계산된다.</p>

            <div className="controls vote-controls">
                <div className="switch" role="group" aria-label="확정 기준">
                    <button type="button" aria-pressed={threshold === 2} onClick={() => setThreshold(2)}>
                        2/3 기준
                    </button>
                    <button type="button" aria-pressed={threshold === 3} onClick={() => setThreshold(3)}>
                        3/3 기준
                    </button>
                </div>
                <div className="arrivals" role="group" aria-label="48초 안에 도착한 응답">
                    <span className="arrivals-label">48초 안에 도착</span>
                    {SAMPLES.map(({ label }, index) => (
                        <button
                            key={label}
                            type="button"
                            className="chip"
                            aria-pressed={arrived[index]}
                            onClick={() => toggleArrived(index)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setThreshold(2);
                        setArrived(ALL_ARRIVED);
                    }}
                    disabled={isDefault}
                >
                    처음 상태로
                </button>
            </div>

            <p aria-live="polite" className={`guide guide-${guide.tone}`}>
                {guide.text}
                <span className="guide-detail">{guide.detail}</span>
            </p>

            <div className="screen table-scroll">
                <table className="vote-table">
                    <thead>
                        <tr>
                            <th scope="col">배역</th>
                            <th scope="col">정답</th>
                            {SAMPLES.map(({ label }, index) => (
                                <th key={label} scope="col" className={arrived[index] ? undefined : 'is-off'}>
                                    {label}
                                </th>
                            ))}
                            <th scope="col" className="result-col">
                                결과
                            </th>
                        </tr>
                        <tr className="sub-head">
                            <th />
                            <th />
                            {SAMPLES.map(({ label, error }, index) => (
                                <th key={label} className={arrived[index] ? undefined : 'is-off'}>
                                    {arrived[index] ? error : '마감 초과'}
                                </th>
                            ))}
                            <th className="result-col">
                                {outcome.kind === 'vote' ? `${outcome.threshold}표 이상 확정` : outcome.kind === 'single' ? '그대로 씀' : '실패'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {cells.map(({ role, cell }) => (
                            <tr key={role}>
                                <th scope="row">{role}</th>
                                <td>{TRUTH[role]?.join(', ') ?? <span className="muted">없음</span>}</td>
                                {SAMPLES.map(({ label, casting }, index) => {
                                    const off = !arrived[index];
                                    const bad = !off && isWrong(casting, role);
                                    return (
                                        <td key={label} className={off ? 'is-off' : bad ? 'is-bad' : undefined}>
                                            {casting[role]?.join(', ') ?? '-'}
                                        </td>
                                    );
                                })}
                                <td className={`result-col cell-${cell.status}`}>
                                    <CellView cell={cell} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ul className="tally" aria-label="결과 요약">
                <li className={wrong.length > 0 ? 'bad' : undefined}>틀리게 확정 {wrong.length}</li>
                <li className={empty.length > 0 ? 'warn' : undefined}>비어서 사람이 채울 배역 {empty.length}</li>
                <li>다수결에서 걸러진 배역 {filtered.length}</li>
            </ul>

            <p className="footnote">
                응답 세 개는 글에 나온 오류 유형으로 만든 예시이고, 배우 이름은 알파벳으로 바꿨습니다. 다수결 계산은 회전문 코드를 그대로 옮겨 이 화면에서 실행합니다.
            </p>
        </main>
    );
};
