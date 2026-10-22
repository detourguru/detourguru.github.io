import { useState } from 'react';

import { voteCasting } from './consensus';
import { REQUESTS, ROLES, TRUTH } from './samples';

type Mode = 'single' | 'vote';

const VOTE = voteCasting(REQUESTS, 2);

const isRight = (actors: string[] | undefined, role: string) => actors?.join() === TRUTH[role].join();

export const App = () => {
    const [mode, setMode] = useState<Mode>('single');

    const stored = mode === 'single' ? REQUESTS[0] : VOTE.casting;
    const storedRight = ROLES.every((role) => isRight(stored[role], role));

    return (
        <main className="page">
            <div className="controls">
                <div className="switch" role="group" aria-label="다수결 도입 전후">
                    <button type="button" aria-pressed={mode === 'single'} onClick={() => setMode('single')}>
                        다수결 전
                    </button>
                    <button type="button" aria-pressed={mode === 'vote'} onClick={() => setMode('vote')}>
                        다수결 후
                    </button>
                </div>
            </div>

            <p className="desc">
                {mode === 'single' ? '캐스팅보드를 한 번 읽혀서 그 결과를 그대로 저장한다.' : '같은 캐스팅보드를 세 번 읽혀서 배역마다 다수결로 정한다.'}{' '}
                빨간 칸이 잘못 읽은 칸이다.
            </p>

            <table className="board">
                <thead>
                    <tr>
                        <td />
                        {ROLES.map((role) => (
                            <th key={role} scope="col">
                                {role}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr className="truth">
                        <th scope="row">정답</th>
                        {ROLES.map((role) => (
                            <td key={role}>
                                <span className="actor">{TRUTH[role]}</span>
                            </td>
                        ))}
                    </tr>
                    {REQUESTS.map((casting, index) => {
                        if (mode === 'single' && index > 0) return null; // 다수결 전에는 요청 하나만 보낸다
                        return (
                            <tr key={index} className="request">
                                <th scope="row">요청 {index + 1}</th>
                                {ROLES.map((role) => {
                                    const right = isRight(casting[role], role);
                                    return (
                                        <td key={role} className={right ? undefined : 'is-bad'}>
                                            <span className="actor">{casting[role]}</span>
                                            {!right && <span className="sub">옆 칸 배우</span>}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    <tr className="stored">
                        <th scope="row">
                            저장되는 값
                            <span className="sub">{mode === 'single' ? '요청 1 그대로' : '칸마다 다수결'}</span>
                        </th>
                        {ROLES.map((role) => {
                            const right = isRight(stored[role], role);
                            return (
                                <td key={role} className={right ? 'is-ok' : 'is-bad'}>
                                    <span className="actor">{stored[role]}</span>
                                    {mode === 'vote' && <span className="sub">{VOTE.best[role]?.count}표</span>}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>

            <p aria-live="polite" className={`guide ${storedRight ? 'guide-good' : 'guide-bad'}`}>
                {mode === 'single'
                    ? '요청 하나의 결과를 그대로 저장하니 잘못 읽은 칸도 그대로 남는다.'
                    : '틀린 칸이 요청마다 다르기 때문에 다수결에 따라 정답으로 가장 많이 꼽힌 값을 저장한다.'}
                <span className="guide-detail">
                    {mode === 'single'
                        ? '다시 보내면 맞게 읽을 때도 있지만, 어느 응답을 받을지는 고를 수 없다.'
                        : '배역마다 2표 이상 받은 배우만 저장한다.'}
                </span>
            </p>

            <p className="footnote">다수결 계산은 회전문 코드를 옮겨 이 화면에서 실행합니다.</p>
        </main>
    );
};
