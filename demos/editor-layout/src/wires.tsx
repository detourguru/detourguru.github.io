import { Fragment } from 'react';

import {
    ACTIVITY_ICONS,
    ASSET_TABS,
    CANVAS_MENU,
    CANVAS_STEP,
    GROUP,
    ITEM_SECTIONS,
    ITEM_SHEET,
    ITEMS,
    MENU_GROUPS,
    PROJECT,
    SCENE_ICONS,
    SETTINGS,
    STEP_SCREENS,
    STEPS,
} from './samples';

const Icon = ({ paths }: { paths: string[] }) => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        {paths.map((d) => (
            <path key={d} d={d} />
        ))}
    </svg>
);

const FormRows = ({ count }: { count: number }) => (
    <div className="rows">
        {Array.from({ length: count }, (_, index) => (
            <div key={index} className="row">
                <span className="line" />
                <span className="input" />
            </div>
        ))}
    </div>
);

// 항목 카드 셋을 선으로 이은 캔버스
const ItemCanvas = ({ selected, onSelect }: { selected?: string; onSelect?: (item: string) => void }) => (
    <div className="map">
        {ITEMS.map((item, index) => (
            <Fragment key={item}>
                {index > 0 && <span className="edge" />}
                {onSelect ? (
                    <button type="button" className="node" aria-pressed={selected === item} onClick={() => onSelect(item)}>
                        <span className="node-img" />
                        <span className="node-name">{item}</span>
                    </button>
                ) : (
                    <div className="node">
                        <span className="node-img" />
                        <span className="node-name">{item}</span>
                    </div>
                )}
            </Fragment>
        ))}
    </div>
);

const StepScreen = ({ name }: { name: string }) => {
    const { main, side } = STEP_SCREENS[name];
    if (!main) return null;

    const [nameField, typeField, descField] = main.fields;
    return (
        <div className="step-screen">
            <div className="step-card">
                <span className="step-card-title">{main.title}</span>
                <div className="step-fields">
                    <span className="field">
                        <span className="field-label">{nameField}</span>
                        <span className="input" />
                    </span>
                    <span className="field">
                        <span className="field-label">{typeField}</span>
                        <span className="input select" />
                    </span>
                </div>
                <span className="field">
                    <span className="field-label">{descField}</span>
                    <span className="input input-tall" />
                </span>
            </div>
            <div className="step-side">
                {side?.map(({ title, values }) => (
                    <div key={title} className="step-card">
                        <span className="step-card-title">{title}</span>
                        {values ? (
                            values.map(([label, value]) => (
                                <span key={label} className="stat">
                                    <span>{label}</span>
                                    <span>{value}</span>
                                </span>
                            ))
                        ) : (
                            <span className="input" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const StepsWire = ({ step, onStep }: { step: number; onStep: (step: number) => void }) => {
    const last = step === STEPS.length - 1;

    return (
        <div className="steps">
            <div className="steps-head">
                <span className="steps-title">{STEPS[step]}</span>
                <span className="progress">
                    <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
                </span>
                {step > 0 && (
                    <button type="button" className="wbtn" onClick={() => onStep(step - 1)}>
                        이전
                    </button>
                )}
                <button type="button" className="wbtn wbtn-strong" disabled={last} onClick={() => onStep(step + 1)}>
                    {last ? '완료' : '다음'}
                </button>
            </div>
            <div className="card">{step === CANVAS_STEP ? <ItemCanvas /> : <StepScreen name={STEPS[step]} />}</div>
        </div>
    );
};

export const MenuWire = ({
    group,
    item,
    onGroup,
    onItem,
}: {
    group: number;
    item: string;
    onGroup: (group: number) => void;
    onItem: (item: string) => void;
}) => (
    <div className="menu">
        <div className="tabs">
            {MENU_GROUPS.map(({ name }, index) => (
                <button key={name} type="button" className="tab" aria-pressed={index === group} onClick={() => onGroup(index)}>
                    {name}
                </button>
            ))}
        </div>
        <div className="menu-body">
            <div className="sidenav">
                <span className="sidenav-title">{MENU_GROUPS[group].name}</span>
                {MENU_GROUPS[group].items.map((name) => (
                    <button key={name} type="button" className="side-item" aria-pressed={name === item} onClick={() => onItem(name)}>
                        {name}
                    </button>
                ))}
            </div>
            <div className="menu-main">
                <div className="titlebar">
                    <span className="titlebar-name">{item}</span>
                    {item !== CANVAS_MENU && <span className="wbtn wbtn-strong">저장하기</span>}
                </div>
                <div className="card">{item === CANVAS_MENU ? <ItemCanvas /> : <FormRows count={4} />}</div>
            </div>
        </div>
    </div>
);

export const PanelWire = ({
    selected,
    assetTab,
    onSelect,
    onAssetTab,
}: {
    selected: string;
    assetTab: string;
    onSelect: (name: string) => void;
    onAssetTab: (tab: string) => void;
}) => (
    <div className="panel">
        <div className="activity" aria-hidden="true">
            {ACTIVITY_ICONS.map((paths, index) => (
                <Icon key={index} paths={paths} />
            ))}
        </div>
        <div className="nav">
            <span className="nav-head">{PROJECT}</span>
            <span className="nav-group">설정</span>
            {SETTINGS.map((name) => (
                <button key={name} type="button" className="nav-item" aria-pressed={name === selected} onClick={() => onSelect(name)}>
                    {name}
                </button>
            ))}
            <span className="nav-group">구성</span>
            <span className="nav-sub">{GROUP}</span>
            {ITEMS.map((item) => (
                <button key={item} type="button" className="nav-item nav-item-deep" aria-pressed={item === selected} onClick={() => onSelect(item)}>
                    {item}
                </button>
            ))}
        </div>
        <div className="center">
            <span className="pane-head">{GROUP}</span>
            <div className="center-map">
                <ItemCanvas selected={selected} onSelect={onSelect} />
            </div>
            <div className="center-db">
                <div className="db-tabs">
                    {ASSET_TABS.map((tab) => (
                        <button key={tab} type="button" className="db-tab" aria-pressed={tab === assetTab} onClick={() => onAssetTab(tab)}>
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="db-grid">
                    {Array.from({ length: ASSET_TABS.indexOf(assetTab) + 3 }, (_, index) => (
                        <span key={index} className="tile">
                            <span className="node-img" />
                            <span className="line" />
                        </span>
                    ))}
                </div>
            </div>
        </div>
        <div className="inspector">
            <span className="pane-head">속성</span>
            <div className="inspector-title">
                <span>{selected}</span>
                <span className="wbtn">저장</span>
            </div>
            {ITEMS.includes(selected) ? (
                <div className="sections">
                    {ITEM_SECTIONS.map((name) => (
                        <span key={name} className="section">
                            {name}
                        </span>
                    ))}
                </div>
            ) : (
                <FormRows count={3} />
            )}
        </div>
    </div>
);

export const MobileWire = ({ open, onOpen }: { open: boolean; onOpen: (open: boolean) => void }) => (
    <div className="phone-wrap">
        <div className="phone">
            <div className="m-head">
                <span aria-hidden="true">‹</span>
                <span className="m-name">{PROJECT}</span>
                <span className="wbtn">미리보기</span>
            </div>
            <div className="m-loc">
                <span aria-hidden="true">⌂</span>
                <span className="m-name">{ITEMS[0]}</span>
                <span className="wbtn">전체</span>
            </div>
            <div className="m-scene">
                <div className="m-row">
                    <button type="button" className="m-chip" aria-expanded={open} onClick={() => onOpen(true)}>
                        설정
                    </button>
                    <span className="m-icons" aria-hidden="true">
                        {SCENE_ICONS.map((paths, index) => (
                            <Icon key={index} paths={paths} />
                        ))}
                    </span>
                </div>
                <div className="m-desc">
                    <div className="lines">
                        <span className="line" />
                        <span className="line" />
                    </div>
                </div>
                <span className="m-put">+ 여기에 추가</span>
            </div>
            <div className="m-bottom">
                <span className="wbtn">전체 설정</span>
                <span className="wbtn wbtn-strong">게시하기</span>
            </div>
            {open && (
                <div className="m-backdrop">
                    <div className="m-sheet" role="dialog" aria-label="무엇을 바꿔볼까요?">
                        <div className="m-sheet-head">
                            <span>무엇을 바꿔볼까요?</span>
                            <button type="button" className="m-close" aria-label="닫기" onClick={() => onOpen(false)}>
                                ×
                            </button>
                        </div>
                        {ITEM_SHEET.map((name) => (
                            <span key={name} className="m-sheet-item">
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
);
