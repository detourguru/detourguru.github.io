import { useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { MessageItem } from '../MessageItem';
import type { Message } from '../messages';
import { MountRegistryContext, type MountRegistry } from '../mountRegistry';
import { useStickToBottom } from './useStickToBottom';

const MAX_MESSAGES = 30;
const MAX_ROW_HEIGHT = 320;
const KEEP_MOUNTED = { top: 12000, bottom: 1200 };

if (MAX_MESSAGES * MAX_ROW_HEIGHT >= KEEP_MOUNTED.top) throw new Error('increaseViewportBy.top이 목록 전체 높이보다 작습니다');

type Props = {
    messages: Message[];
    fixed: boolean;
    registry: MountRegistry;
    scroller: HTMLElement | null;
    onScrollerChange: (el: HTMLElement | null) => void;
};

export const VirtuosoList = ({ messages, fixed, registry, scroller, onScrollerChange }: Props) => {
    const data = fixed ? messages.slice(-MAX_MESSAGES) : messages;
    const stickToBottom = useStickToBottom(scroller, fixed);

    const handleScrollerRef = useCallback(
        (ref: HTMLElement | Window | null) => onScrollerChange(ref instanceof HTMLElement ? ref : null),
        [onScrollerChange],
    );

    // increaseViewportBy에 undefined를 넘기면 virtuoso가 기본값을 쓰지 않고 깨지므로 꺼진 값도 0으로 넘긴다
    return (
        <MountRegistryContext value={registry}>
            <Virtuoso
                className="scroller"
                data={data}
                computeItemKey={(_, message) => message.id}
                itemContent={(_, message) => <MessageItem message={message} fixedHeight={fixed} />}
                initialTopMostItemIndex={data.length - 1}
                followOutput={fixed ? false : 'auto'}
                increaseViewportBy={fixed ? KEEP_MOUNTED : 0}
                totalListHeightChanged={fixed ? stickToBottom : undefined}
                scrollerRef={handleScrollerRef}
            />
        </MountRegistryContext>
    );
};
