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
            <p className="desc">같은 캐스팅보드를 세 번 읽혔다. 빨간 칸이 잘못 읽은 칸이다.</p>

            <div className="controls">
                <div className="switch" role="group" aria-label="보내는 방법">
                    <button type="button" aria-pressed={mode === 'single'} onClick={() => setMode('single')}>
                        한 번만 보내기
                    </button>
                    <button type="button" aria-pressed={mode === 'vote'} onClick={() => setMode('vote')}>
                        세 번 보내 다수결
                    </button>
                </div>
            </div>

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
                        const sent = mode === 'vote' || index === 0;
                        return (
                            <tr key={index} className={sent ? 'request' : 'request is-off'}>
                                <th scope="row">
                                    요청 {index + 1}
                                    {!sent && <span className="sub">안 보냄</span>}
                                </th>
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
                {mode === 'single' ? '한 번만 보내면 잘못 읽은 칸도 그대로 저장된다.' : '틀린 칸이 요청마다 달라서, 틀린 값은 1표밖에 못 받고 걸러진다.'}
                <span className="guide-detail">
                    {mode === 'single'
                        ? '요청 2처럼 맞게 읽을 때도 있지만, 어느 응답을 받을지는 고를 수 없다.'
                        : '배역마다 2표 이상 받은 배우만 저장한다.'}
                </span>
            </p>

            <p className="footnote">배우는 이모지로 바꿨습니다. 다수결 계산은 회전문 코드를 옮겨 이 화면에서 실행합니다.</p>
        </main>
    );
};
