import { ConnectionMode, type FitViewOptions, ReactFlow, type ReactFlowProps } from '@xyflow/react';

import type { MapEdge, MapNode } from './flow';
import { nodeTypes } from './LocationNode';
import { useColorMode } from './useColorMode';

export const FIT_OPTIONS: FitViewOptions = { padding: { top: '60px', bottom: '36px', left: '16px', right: '16px' }, maxZoom: 1 };

type Props = Omit<ReactFlowProps<MapNode, MapEdge>, 'nodeTypes' | 'colorMode'>;

export const MapFlow = (props: Props) => {
    const colorMode = useColorMode();

    return (
        <ReactFlow<MapNode, MapEdge>
            nodeTypes={nodeTypes}
            colorMode={colorMode}
            // 핸들이 전부 source라서 Loose 모드가 아니면 엣지가 이어지지 않는다
            connectionMode={ConnectionMode.Loose}
            nodesConnectable={false}
            nodesDraggable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            preventScrolling={false}
            minZoom={0.2}
            maxZoom={2.5}
            {...props}
        />
    );
};
