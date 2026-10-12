import { Handle, type NodeProps, type NodeTypes, Position } from '@xyflow/react';
import type { CSSProperties } from 'react';

import type { EmptyCellNode, LocationFlowNode } from './flow';
import type { HandleId } from './grid';

const HANDLES: readonly { id: HandleId; position: Position; style: CSSProperties }[] = [
    { id: 'top', position: Position.Top, style: { top: '0%', left: '50%' } },
    { id: 'top-right', position: Position.Top, style: { top: '0%', left: '100%' } },
    { id: 'top-left', position: Position.Top, style: { top: '0%', left: '0%' } },
    { id: 'bottom', position: Position.Bottom, style: { bottom: '0%', left: '50%' } },
    { id: 'bottom-right', position: Position.Bottom, style: { bottom: '0%', left: '100%' } },
    { id: 'bottom-left', position: Position.Bottom, style: { bottom: '0%', left: '0%' } },
    { id: 'left', position: Position.Left, style: { left: '0%', top: '50%' } },
    { id: 'right', position: Position.Right, style: { right: '0%', top: '50%' } },
];

export const LocationNode = ({ data }: NodeProps<LocationFlowNode>) => {
    const { location, foreign, duplicates, highlight } = data;
    const className = ['location-card', foreign && 'is-foreign', highlight && 'is-highlight', duplicates > 0 && 'is-duplicated']
        .filter(Boolean)
        .join(' ');

    return (
        <div className={className}>
            {HANDLES.map((handle) => (
                <Handle
                    key={handle.id}
                    id={handle.id}
                    type="source"
                    position={handle.position}
                    style={handle.style}
                    className="hidden-handle"
                    isConnectable={false}
                />
            ))}
            <strong className="location-name">{location.name}</strong>
            <span className="location-coord">
                ({location.coordinate.row}, {location.coordinate.col})
            </span>
            {foreign && <span className="location-tag">다른 지역</span>}
            {duplicates > 0 && <span className="location-badge">중복 ×{duplicates + 1}</span>}
        </div>
    );
};

export const EmptyCell = (_props: NodeProps<EmptyCellNode>) => <div className="empty-cell" aria-hidden="true" />;

export const nodeTypes: NodeTypes = {
    location: LocationNode,
    empty: EmptyCell,
};
