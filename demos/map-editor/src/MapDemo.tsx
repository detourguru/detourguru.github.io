import { useMemo, useReducer, useState } from 'react';

import { AREA_FLOWS, AreaScreen, type Version } from './AreaScreen';
import { coordKey, type Coordinate } from './grid';
import { buildMoveFlow, canMoveTo, MoveScreen, PLACES, PLAZA_AWAY, PLAZA_HOME, staleTargets } from './MoveScreen';
import { DomArrowScreen, FlowPanScreen } from './PanScreens';
import { type Case, CASE_LABEL, guideFor, TUTORIAL_START, tutorialReducer, VERSION_LABEL } from './tutorial';

const CASES = (['pan', 'move', 'area'] as const).map((id) => ({ id, label: CASE_LABEL[id] }));
const VERSIONS = (['before', 'after'] as const).map((id) => ({ id, label: VERSION_LABEL[id] }));

const METHOD: Record<Case, Record<Version, string>> = {
    pan: { before: 'CSS grid + DOM 위치를 재서 그린 화살표', after: 'React Flow 노드와 엣지' },
    move: { before: '저장된 이웃 + 화면에서 계산한 이웃을 합침', after: '옮길 때마다 서버가 이웃을 다시 계산' },
    area: { before: '두 목록을 이어붙임', after: 'Set으로 합치고 다른 지역 이웃은 비움' },
};

const GAP_PX = 3;

type Alert = { tone: 'good' | 'bad'; text: string } | null;

const Switch = <T extends string>({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: readonly { id: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}) => (
    <div className="switch" role="group" aria-label={label}>
        {options.map((option) => (
            <button key={option.id} type="button" aria-pressed={option.id === value} onClick={() => onChange(option.id)}>
                {option.label}
            </button>
        ))}
    </div>
);

const Count = ({ value }: { value: number }) => <b className={value > 0 ? 'bad' : 'good'}>{value}</b>;

const areaAlert = (version: Version): Alert => {
    const { bogusEdges } = AREA_FLOWS[version].stats;
    return bogusEdges > 0
        ? { tone: 'bad', text: `다른 지역 좌표로 화살표 ${bogusEdges}개가 잘못 생김` }
        : { tone: 'good', text: '잘못 생긴 화살표 0개' };
};

export const MapDemo = () => {
    const [caseId, setCaseId] = useState<Case>('pan');
    const [version, setVersion] = useState<Version>('before');
    const [tutorial, observe] = useReducer(tutorialReducer, TUTORIAL_START);
    const [alert, setAlert] = useState<Alert>(null);
    const [moved, setMoved] = useState(false);
    const [gap, setGap] = useState<number | null>(null);
    const [places, setPlaces] = useState(PLACES);
    const moveFlow = useMemo(() => buildMoveFlow(places, version), [places, version]);

    const open = (nextCase: Case, nextVersion: Version) => {
        setCaseId(nextCase);
        setVersion(nextVersion);
        setMoved(false);
        setGap(null);
        setPlaces(PLACES);
        setAlert(nextCase === 'area' ? areaAlert(nextVersion) : null);
        if (nextCase === 'area') {
            observe({ caseId: 'area', version: nextVersion, detected: AREA_FLOWS[nextVersion].stats.bogusEdges > 0 });
        }
    };

    const handleGap = (px: number) => {
        const detected = px > GAP_PX;
        setGap(px);
        setAlert(detected ? { tone: 'bad', text: `화살표가 카드에서 ${px}px 떨어짐` } : { tone: 'good', text: '화살표가 그대로 붙어 있음' });
        observe({ caseId: 'pan', version, detected });
    };

    const movePlace = (id: string, target: Coordinate) => {
        if (!canMoveTo(places, id, target)) return false;
        const next = places.map((p) => (p.id === id ? { ...p, coordinate: target } : p));
        const stale = staleTargets(buildMoveFlow(next, version));
        setPlaces(next);
        setAlert(
            stale.length > 0
                ? { tone: 'bad', text: `옮겼는데 예전 이웃(${stale.join(', ')}) 화살표가 남아 있음` }
                : { tone: 'good', text: '1칸 밖 이웃 화살표가 사라짐' },
        );
        if (stale.length > 0 || id !== 'plaza' || coordKey(target) !== coordKey(PLAZA_HOME)) {
            observe({ caseId: 'move', version, detected: stale.length > 0 });
        }
        return true;
    };

    const plaza = places.find((p) => p.id === 'plaza');
    const plazaAtHome = plaza !== undefined && coordKey(plaza.coordinate) === coordKey(PLAZA_HOME);
    const guide = guideFor(tutorial, caseId, version);
    const areaStats = AREA_FLOWS[version].stats;

    return (
        <main className="page">
            <header className="title">
                <h1>맵 에디터: 카드와 화살표</h1>
            </header>
            <p className="guide" data-testid="guide" aria-live="polite">
                {guide.counter && <span className="guide-counter">{guide.counter}</span>}
                {guide.text}
            </p>

            <div className="screen map-screen">
                {caseId === 'pan' &&
                    (version === 'before' ? (
                        <DomArrowScreen moved={moved} onGap={handleGap} />
                    ) : (
                        <FlowPanScreen moved={moved} onGap={handleGap} />
                    ))}
                {caseId === 'move' && <MoveScreen key={version} places={places} flow={moveFlow} onMove={movePlace} />}
                {caseId === 'area' && <AreaScreen key={version} version={version} />}
                <div className="screen-top">
                    <p className="screen-note">{METHOD[caseId][version]}</p>
                    {alert && (
                        <p className={`screen-alert ${alert.tone}`} data-testid="alert">
                            {alert.text}
                        </p>
                    )}
                </div>
                {caseId !== 'pan' && (
                    <p className="screen-legend" aria-label="범례">
                        <span className="legend-edge">이웃</span>
                        {caseId === 'area' && <span className="legend-exit">출구</span>}
                        <span className="legend-bogus">{caseId === 'area' ? '잘못 생긴 화살표' : '1칸 밖으로 남은 화살표'}</span>
                    </p>
                )}
            </div>

            <div className="controls">
                <Switch label="문제" options={CASES} value={caseId} onChange={(next) => open(next, version)} />
                <Switch label="버전" options={VERSIONS} value={version} onChange={(next) => open(caseId, next)} />
                {caseId === 'pan' && (
                    <button type="button" className="primary action" onClick={() => setMoved((on) => !on)}>
                        {moved ? '원래대로' : '화면 옮기기'}
                    </button>
                )}
                {caseId === 'move' && (
                    <button
                        type="button"
                        className="primary action"
                        onClick={() => movePlace('plaza', plazaAtHome ? PLAZA_AWAY : PLAZA_HOME)}
                    >
                        {plazaAtHome ? '광장을 두 칸 옮기기' : '원래대로'}
                    </button>
                )}
                {caseId === 'area' && (
                    <button type="button" className="primary action is-placeholder" tabIndex={-1} aria-hidden="true">
                        &nbsp;
                    </button>
                )}
            </div>

            <p className="readout" aria-live="polite">
                {caseId === 'pan' && (
                    <>
                        화살표와 카드 사이{' '}
                        {gap === null ? <b>0</b> : <b className={gap > GAP_PX ? 'bad' : 'good'}>{gap}</b>}px
                    </>
                )}
                {caseId === 'move' && (
                    <>
                        1칸 밖인데 남은 화살표 <Count value={moveFlow.stats.bogusEdges} />개
                    </>
                )}
                {caseId === 'area' && (
                    <>
                        중복 노드 <Count value={areaStats.duplicateNodes} />, 잘못 생긴 화살표 <Count value={areaStats.bogusEdges} />
                    </>
                )}
            </p>
        </main>
    );
};
