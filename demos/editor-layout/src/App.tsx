import { useState } from 'react';

import {
    ASSET_TABS,
    CANVAS_MENU,
    CANVAS_STEP,
    ITEMS,
    MENU_GROUPS,
    STAGES,
    STEP_SCREENS,
    STEPS,
    type StageId,
} from './samples';
import { MenuWire, MobileWire, PanelWire, StepsWire } from './wires';

export const App = () => {
    const [stage, setStage] = useState<StageId>('steps');
    const [step, setStep] = useState(0);
    const [group, setGroup] = useState(MENU_GROUPS.findIndex(({ name }) => name === '구성'));
    const [item, setItem] = useState('항목');
    const [selected, setSelected] = useState(ITEMS[0]);
    const [assetTab, setAssetTab] = useState(ASSET_TABS[0]);
    const [sheetOpen, setSheetOpen] = useState(false);

    const current = STAGES.find(({ id }) => id === stage) ?? STAGES[0];

    const selectGroup = (index: number) => {
        setGroup(index);
        setItem(MENU_GROUPS[index].items[0]); // 탭을 바꾸면 그 묶음의 첫 메뉴가 열린다
    };

    const guide = (() => {
        switch (stage) {
            case 'steps':
                return {
                    text: STEP_SCREENS[STEPS[step]].summary,
                    detail:
                        step === CANVAS_STEP
                            ? `${STEPS[0]}를 고치려면 이전을 ${CANVAS_STEP}번 눌러 돌아가야 한다.`
                            : `${STEPS[CANVAS_STEP]} 화면을 보려면 다음을 ${CANVAS_STEP - step}번 눌러야 한다.`,
                };
            case 'menu':
                return {
                    text: `가운데 카드에는 ${item} 화면 하나만 보인다.`,
                    detail:
                        item === CANVAS_MENU
                            ? '캔버스를 보는 동안에는 항목 화면을 볼 수 없다.'
                            : item === '항목'
                              ? '캔버스를 보려면 왼쪽 메뉴에서 캔버스를 눌러 카드를 바꿔야 한다.'
                              : '다른 메뉴를 누르면 이 카드가 그 화면으로 바뀐다.',
                };
            case 'panel':
                return {
                    text: `오른쪽 속성 패널만 ${selected} 화면으로 바뀌고 캔버스와 에셋 목록은 그대로 보인다.`,
                    detail: '왼쪽 메뉴에서 눌러도 캔버스에서 항목을 눌러도 같다.',
                };
            case 'mobile':
                return sheetOpen
                    ? { text: '설정 목록이 화면을 덮는다.', detail: '닫기를 누르면 원래 화면으로 돌아온다.' }
                    : {
                          text: '사용자가 보는 화면과 같은 틀에서 내용을 바로 고친다.',
                          detail: '설정 버튼을 누르면 설정 목록이 뜬다.',
                      };
        }
    })();

    return (
        <main className="page">
            <div className="controls">
                <div className="switch" role="group" aria-label="에디터 레이아웃 시기">
                    {STAGES.map(({ id, label }) => (
                        <button key={id} type="button" aria-pressed={stage === id} onClick={() => setStage(id)}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <p className="desc">{current.desc}</p>

            <div className="wire-frame">
                <div className="wire" role="group" aria-label={`${current.label} 에디터 와이어프레임`}>
                    {stage === 'steps' && <StepsWire step={step} onStep={setStep} />}
                    {stage === 'menu' && <MenuWire group={group} item={item} onGroup={selectGroup} onItem={setItem} />}
                    {stage === 'panel' && (
                        <PanelWire selected={selected} assetTab={assetTab} onSelect={setSelected} onAssetTab={setAssetTab} />
                    )}
                    {stage === 'mobile' && <MobileWire open={sheetOpen} onOpen={setSheetOpen} />}
                </div>
            </div>

            <p aria-live="polite" className="guide">
                {guide.text}
                <span className="guide-detail">{guide.detail}</span>
            </p>

            <p className="footnote">해당 시기의 구조만 옮겨 그렸습니다.</p>
        </main>
    );
};
