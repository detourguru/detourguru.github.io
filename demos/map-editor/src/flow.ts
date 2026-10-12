import { type Edge, MarkerType, type Node } from '@xyflow/react';

import { cardId, type Coordinate, getAnchorCoordinates, gridToPixel } from './grid';
import type { Location } from './mapData';

export type EdgeKind = 'normal' | 'exit' | 'bogus';

export type LocationNodeData = {
    location: Location;
    foreign: boolean;
    duplicates: number;
    highlight: boolean;
};
export type LocationFlowNode = Node<LocationNodeData, 'location'>;

export type EmptyCellData = { coordinate: Coordinate };
export type EmptyCellNode = Node<EmptyCellData, 'empty'>;

export type MapNode = LocationFlowNode | EmptyCellNode;
export type MapEdge = Edge<{ kind: EdgeKind }>;

const EDGE_STYLE: Record<EdgeKind, { color: string; width: number; dash?: string }> = {
    normal: { color: 'var(--edge)', width: 2 },
    exit: { color: 'var(--exit)', width: 3, dash: '5 4' },
    bogus: { color: 'var(--bad)', width: 2.5 },
};

const makeEdge = (
    id: string,
    source: string,
    target: string,
    sourceHandle: string,
    targetHandle: string,
    kind: EdgeKind,
): MapEdge => {
    const { color, width, dash } = EDGE_STYLE[kind];
    return {
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: 'straight',
        data: { kind },
        zIndex: kind === 'bogus' ? 1000 : undefined,
        style: { stroke: color, strokeWidth: width, strokeDasharray: dash },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    };
};

interface BuildOptions {
    currentAreaId?: string;
    highlightIds?: ReadonlySet<string>;
    markFar?: boolean;
}

export const cellDistance = (a: Coordinate, b: Coordinate) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

export interface FlowStats {
    duplicateNodes: number;
    bogusEdges: number;
    exitEdges: number;
    normalEdges: number;
}

export const buildFlow = (locations: readonly Location[], options: BuildOptions = {}) => {
    const nodes: LocationFlowNode[] = [];
    const nodeIndex = new Map<string, number>();
    const edges: MapEdge[] = [];
    const edgeIds = new Set<string>();
    let duplicateNodes = 0;

    const pushEdge = (edge: MapEdge) => {
        if (edgeIds.has(edge.id)) return;
        edgeIds.add(edge.id);
        edges.push(edge);
    };

    for (const location of locations) {
        const startId = cardId(location.coordinate);
        const foreign = options.currentAreaId !== undefined && location.areaId !== options.currentAreaId;

        for (const neighbor of location.neighbors) {
            if (!neighbor.isActivated) continue;

            const targetId = cardId(neighbor.coordinate);
            if (targetId === startId) continue;

            const edgeId = `${startId}-${targetId}`;
            const { sourceHandle, targetHandle } = getAnchorCoordinates(location.coordinate, neighbor.coordinate);
            const far = options.markFar === true && cellDistance(location.coordinate, neighbor.coordinate) > 1;
            const kind: EdgeKind = neighbor.isExit ? 'exit' : foreign || far ? 'bogus' : 'normal';
            pushEdge(makeEdge(edgeId, startId, targetId, sourceHandle, targetHandle, kind));

            if (neighbor.isExit) {
                pushEdge(makeEdge(`${edgeId}-reverse`, targetId, startId, targetHandle, sourceHandle, kind));
            }
        }

        // 같은 id 노드를 두 번 넘기면 React Flow가 중복 key 경고를 내므로 개수만 센다
        const existing = nodeIndex.get(startId);
        if (existing !== undefined) {
            nodes[existing].data.duplicates += 1;
            duplicateNodes += 1;
            continue;
        }
        nodeIndex.set(startId, nodes.length);
        nodes.push({
            id: startId,
            type: 'location',
            position: gridToPixel(location.coordinate),
            data: {
                location,
                foreign,
                duplicates: 0,
                highlight: options.highlightIds?.has(location.id) ?? false,
            },
        });
    }

    const drawable = edges.filter((edge) => nodeIndex.has(edge.source) && nodeIndex.has(edge.target));
    const count = (kind: EdgeKind) => drawable.filter((edge) => edge.data?.kind === kind).length;
    const stats: FlowStats = {
        duplicateNodes,
        bogusEdges: count('bogus'),
        exitEdges: count('exit'),
        normalEdges: count('normal'),
    };

    return { nodes, edges: drawable, stats };
};
