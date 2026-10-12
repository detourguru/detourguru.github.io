import { type OnNodeDrag, useNodesState } from '@xyflow/react';
import { useEffect } from 'react';

import type { Version } from './AreaScreen';
import { buildFlow, type EmptyCellNode, type MapNode } from './flow';
import { CARD_SIZE, CELL, type Coordinate, coordKey, DIRECTIONS, GRID_GAP, gridToPixel } from './grid';
import { FIT_OPTIONS, MapFlow } from './MapFlow';
import type { Location, Neighbor } from './mapData';

export interface Place {
    id: string;
    name: string;
    coordinate: Coordinate;
}

const ROWS = 4;
const COLS = 3;

export const PLACES: readonly Place[] = [
    { id: 'well', name: '우물', coordinate: { row: 0, col: 1 } },
    { id: 'plaza', name: '광장', coordinate: { row: 1, col: 1 } },
    { id: 'market', name: '시장', coordinate: { row: 1, col: 2 } },
    { id: 'gate', name: '성문', coordinate: { row: 2, col: 2 } },
    { id: 'lake', name: '호숫가', coordinate: { row: 2, col: 0 } },
];

export const PLAZA_HOME: Coordinate = { row: 1, col: 1 };
export const PLAZA_AWAY: Coordinate = { row: 3, col: 1 };

const neighborsAt = (places: readonly Place[], { row, col }: Coordinate): Neighbor[] =>
    DIRECTIONS.flatMap(([dr, dc]) => {
        const found = places.find((p) => p.coordinate.row === row + dr && p.coordinate.col === col + dc);
        return found ? [{ id: found.id, name: found.name, coordinate: found.coordinate, isActivated: true, isExit: false }] : [];
    });

const STORED = new Map(PLACES.map((place) => [place.id, neighborsAt(PLACES, place.coordinate)]));

const toLocations = (places: readonly Place[], version: Version): Location[] =>
    places.map((place) => {
        const calculated = neighborsAt(places, place.coordinate);
        if (version === 'after') {
            return { ...place, areaId: 'village', neighbors: calculated };
        }
        // 저장된 이웃이 앞에 와야 같은 칸에서 예전 이웃이 남는 현상이 재현된다
        const unique = new Map<string, Neighbor>();
        for (const neighbor of [...(STORED.get(place.id) ?? []), ...calculated]) {
            const key = coordKey(neighbor.coordinate);
            if (!unique.has(key)) unique.set(key, neighbor);
        }
        return { ...place, areaId: 'village', neighbors: [...unique.values()] };
    });

export const buildMoveFlow = (places: readonly Place[], version: Version) =>
    buildFlow(toLocations(places, version), { markFar: true });

export type MoveFlow = ReturnType<typeof buildMoveFlow>;

export const staleTargets = (flow: MoveFlow) => {
    const names = new Map(flow.nodes.map((node) => [node.id, node.data.location.name]));
    return flow.edges.filter((edge) => edge.data?.kind === 'bogus').map((edge) => names.get(edge.target) ?? edge.target);
};

export const canMoveTo = (places: readonly Place[], id: string, target: Coordinate) =>
    target.row >= 0 &&
    target.col >= 0 &&
    target.row < ROWS &&
    target.col < COLS &&
    !places.some((p) => p.id !== id && coordKey(p.coordinate) === coordKey(target));

const buildNodes = (places: readonly Place[], flow: MoveFlow): MapNode[] => {
    const taken = new Set(places.map((p) => coordKey(p.coordinate)));
    const empties: EmptyCellNode[] = [];
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            const coordinate = { row, col };
            if (taken.has(coordKey(coordinate))) continue;
            empties.push({
                id: `empty-${row}-${col}`,
                type: 'empty',
                position: gridToPixel(coordinate),
                data: { coordinate },
                draggable: false,
                selectable: false,
                focusable: false,
                zIndex: -1,
                width: CARD_SIZE,
                height: CARD_SIZE,
            });
        }
    }
    return [...empties, ...flow.nodes];
};

const NODE_EXTENT: [[number, number], [number, number]] = [
    [0, 0],
    [COLS * CELL - GRID_GAP, ROWS * CELL - GRID_GAP],
];

interface Props {
    places: readonly Place[];
    flow: MoveFlow;
    onMove: (id: string, target: Coordinate) => boolean;
}

export const MoveScreen = ({ places, flow, onMove }: Props) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<MapNode>(buildNodes(places, flow));

    useEffect(() => {
        setNodes(buildNodes(places, flow));
    }, [places, flow, setNodes]);

    const handleNodeDragStop: OnNodeDrag<MapNode> = (_event, node) => {
        if (node.type !== 'location') return;
        const target = { row: Math.round(node.position.y / CELL), col: Math.round(node.position.x / CELL) };
        const { location } = node.data;
        if (coordKey(target) === coordKey(location.coordinate) || !onMove(location.id, target)) {
            setNodes(buildNodes(places, flow));
        }
    };

    return (
        <div className="flow-viewport">
            <MapFlow
                nodes={nodes}
                edges={flow.edges}
                onNodesChange={onNodesChange}
                nodesDraggable
                snapToGrid
                snapGrid={[CELL, CELL]}
                nodeExtent={NODE_EXTENT}
                onNodeDragStop={handleNodeDragStop}
                fitView
                fitViewOptions={FIT_OPTIONS}
            />
        </div>
    );
};
