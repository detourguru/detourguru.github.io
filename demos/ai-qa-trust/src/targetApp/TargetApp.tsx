import { useSyncExternalStore, type Ref } from 'react';

import type { Spot } from '../Finding';
import type { TargetController } from './controller';

type Props = {
    controller: TargetController;
    shareAsLink: boolean;
    containerRef: Ref<HTMLDivElement>;
    spots?: Spot[];
};

export const TargetApp = (props: Props) => {
    const { controller, shareAsLink, containerRef, spots = [] } = props;
    const spot = (name: Spot) => (spots.includes(name) ? 'is-spot' : undefined);
    const s = useSyncExternalStore(controller.subscribe, controller.getState);

    return (
        <div className="target-app" ref={containerRef}>
            <div className="target-bar">
                <span>도현님</span>
                <span className={spot('balance')}>잔액 {s.balance === null ? '-' : `${s.balance.toLocaleString('ko-KR')}P`}</span>
            </div>
            {s.status === 'idle' && <p className="target-empty">여정을 실행하면 상세 화면이 열립니다.</p>}
            {s.status === 'loading' && <p className="target-empty">불러오는 중…</p>}
            {s.status === 'ready' && (
                <article className="target-detail">
                    <h3 className={spot('title')}>{s.title}</h3>
                    <p className="target-author">작성자 {s.authorName}, {s.price}P</p>
                    <div className="target-actions">
                        <button type="button" onClick={controller.purchase}>
                            구매
                        </button>
                        {shareAsLink ? (
                            <a href="#share" className={spot('share')} onClick={(e) => e.preventDefault()}>
                                공유하기
                            </a>
                        ) : (
                            <button type="button">공유</button>
                        )}
                        {s.canEdit && (
                            <button type="button" className={spot('edit')}>
                                편집
                            </button>
                        )}
                    </div>
                    {s.purchaseMessage && <p className="target-msg">{s.purchaseMessage}</p>}
                </article>
            )}
        </div>
    );
};
