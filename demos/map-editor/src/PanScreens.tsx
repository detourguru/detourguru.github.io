import type { ReactFlowInstance } from '@xyflow/react';
import {
    type PointerEvent,
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import { buildFlow, type EmptyCellNode, type MapEdge, type MapNode } from './flow';
import {
    CARD_SIZE,
    cardId,
    type Coordinate,
    coordKey,
    DIRECTIONS,
    fitTransform,
    getAnchorCoordinates,
    GRID_GAP,
    gridExtent,
    gridToPixel,
    type HandleId,
    movedTransform,
    type Transform,
} from './grid';
import { MapFlow } from './MapFlow';
import { type Location, panMap } from './mapData';

const DURATION = 450;
const LOCATIONS = panMap.locations;
const EXTENT = gridExtent(LOCATIONS.map((loc) => loc.coordinate));

interface Targets {
    fit: Transform;
    moved: Transform;
}

const targetsFor = (element: HTMLElement): Targets => {
    const { clientWidth: w, clientHeight: h } = element;
    const fit = fitTransform(w, h, EXTENT.width, EXTENT.height);
    return { fit, moved: movedTransform(fit, w, h) };
};

const ease = (t: number) => 1 - (1 - t) ** 3;
const lerp = (a: Transform, b: Transform, t: number): Transform => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    scale: a.scale + (b.scale - a.scale) * t,
});

interface Connection {
    start: string;
    end: string;
    from: Coordinate;
    to: Coordinate;
}

interface Arrow {
    id: string;
    start: string;
    sourceHandle: HandleId;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

const HANDLE_POINT: Record<HandleId, [number, number]> = {
    'top-left': [0, 0],
    top: [0.5, 0],
    'top-right': [1, 0],
    left: [0, 0.5],
    right: [1, 0.5],
    'bottom-left': [0, 1],
    bottom: [0.5, 1],
    'bottom-right': [1, 1],
};

const pointOn = (rect: DOMRect, origin: { left: number; top: number }, handle: HandleId) => {
    const [fx, fy] = HANDLE_POINT[handle];
    return { x: rect.left - origin.left + rect.width * fx, y: rect.top - origin.top + rect.height * fy };
};

const isHandle = (value: string | null | undefined): value is HandleId => value != null && value in HANDLE_POINT;

const gapPx = (card: Element, handle: HandleId, arrowStart: { x: number; y: number }) => {
    const anchor = pointOn(card.getBoundingClientRect(), { left: 0, top: 0 }, handle);
    return Math.round(Math.hypot(anchor.x - arrowStart.x, anchor.y - arrowStart.y));
};

const findConnections = (locations: readonly Location[]): Connection[] => {
    const occupied = new Set(locations.map((loc) => coordKey(loc.coordinate)));
    return locations.flatMap((loc) =>
        DIRECTIONS.flatMap(([dr, dc]) => {
            const to = { row: loc.coordinate.row + dr, col: loc.coordinate.col + dc };
            return occupied.has(coordKey(to)) ? [{ start: cardId(loc.coordinate), end: cardId(to), from: loc.coordinate, to }] : [];
        }),
    );
};

const CONNECTIONS = findConnections(LOCATIONS);
const CELLS = Array.from({ length: EXTENT.rows * EXTENT.cols }, (_, index) => ({
    row: Math.floor(index / EXTENT.cols),
    col: index % EXTENT.cols,
}));
const LOCATION_AT = new Map(LOCATIONS.map((loc) => [coordKey(loc.coordinate), loc]));

interface ScreenProps {
    moved: boolean;
    onGap: (px: number) => void;
}

export const DomArrowScreen = ({ moved, onGap }: ScreenProps) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef(new Map<string, HTMLDivElement>());
    const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
    const frameRef = useRef(0);
    const [targets, setTargets] = useState<Targets | null>(null);
    const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
    const [arrows, setArrows] = useState<Arrow[]>([]);
    const transformRef = useRef(transform);
    useEffect(() => {
        transformRef.current = transform;
    }, [transform]);

    useLayoutEffect(() => {
        if (!viewportRef.current) return;
        const next = targetsFor(viewportRef.current);
        setTargets(next);
        setTransform(next.fit);
    }, []);

    // 화살표는 처음 한 번만 잰다. 다시 재게 하면 고치기 전 현상이 사라진다
    useEffect(() => {
        if (!targets) return;
        const frame = requestAnimationFrame(() => {
            const viewport = viewportRef.current;
            if (!viewport) return;
            const origin = viewport.getBoundingClientRect();
            const next: Arrow[] = [];
            for (const connection of CONNECTIONS) {
                const startCard = cardRefs.current.get(connection.start);
                const endCard = cardRefs.current.get(connection.end);
                if (!startCard || !endCard) continue;
                const { sourceHandle, targetHandle } = getAnchorCoordinates(connection.from, connection.to);
                const p1 = pointOn(startCard.getBoundingClientRect(), origin, sourceHandle);
                const p2 = pointOn(endCard.getBoundingClientRect(), origin, targetHandle);
                next.push({
                    id: `${connection.start}-${connection.end}`,
                    start: connection.start,
                    sourceHandle,
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                });
            }
            setArrows(next);
        });
        return () => cancelAnimationFrame(frame);
    }, [targets]);

    const reportGap = useEffectEvent(() => {
        frameRef.current = requestAnimationFrame(() => {
            const viewport = viewportRef.current;
            const arrow = arrows[0];
            const card = arrow && cardRefs.current.get(arrow.start);
            if (!viewport || !arrow || !card) return;
            const origin = viewport.getBoundingClientRect();
            onGap(gapPx(card, arrow.sourceHandle, { x: origin.left + arrow.x1, y: origin.top + arrow.y1 }));
        });
    });

    const animateTo = useEffectEvent((to: Transform) => {
        cancelAnimationFrame(frameRef.current);
        const from = transformRef.current;
        const start = performance.now();
        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / DURATION);
            setTransform(lerp(from, to, ease(progress)));
            if (progress < 1) frameRef.current = requestAnimationFrame(tick);
            else reportGap();
        };
        frameRef.current = requestAnimationFrame(tick);
    });

    const lastMoved = useRef(moved);
    useEffect(() => {
        if (!targets || lastMoved.current === moved) return;
        lastMoved.current = moved;
        animateTo(moved ? targets.moved : targets.fit);
    }, [moved, targets]);

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    const setCardRef = (id: string) => (element: HTMLDivElement | null) => {
        if (!element) return;
        cardRefs.current.set(id, element);
        return () => {
            cardRefs.current.delete(id);
        };
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        cancelAnimationFrame(frameRef.current);
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, x: transform.x, y: transform.y };
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        setTransform((t) => ({ ...t, x: drag.x + event.clientX - drag.pointerX, y: drag.y + event.clientY - drag.pointerY }));
    };

    const endPan = () => {
        if (!dragRef.current) return;
        dragRef.current = null;
        reportGap();
    };

    return (
        <div
            ref={viewportRef}
            className="dom-viewport"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
        >
            <div
                className="dom-grid"
                style={{
                    visibility: targets ? 'visible' : 'hidden',
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    gridTemplateColumns: `repeat(${EXTENT.cols}, ${CARD_SIZE}px)`,
                    gridTemplateRows: `repeat(${EXTENT.rows}, ${CARD_SIZE}px)`,
                    gap: `${GRID_GAP}px`,
                }}
            >
                {CELLS.map((cell) => {
                    const location = LOCATION_AT.get(coordKey(cell));
                    const style = { gridRow: cell.row + 1, gridColumn: cell.col + 1 };
                    if (!location) return <div key={coordKey(cell)} className="empty-cell" style={style} />;
                    const id = cardId(cell);
                    return (
                        <div key={location.id} ref={setCardRef(id)} className="location-card" style={style}>
                            <strong className="location-name">{location.name}</strong>
                            <span className="location-coord">
                                ({cell.row}, {cell.col})
                            </span>
                        </div>
                    );
                })}
            </div>
            {/* 화살표 레이어는 transform이 걸린 영역 밖에 둬야 고치기 전 현상이 재현된다 */}
            <svg className="dom-arrows" aria-hidden="true">
                <defs>
                    <marker id="dom-arrowhead" viewBox="-10 -10 20 20" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
                        <polyline points="-5,-4 0,0 -5,4 -5,-4" className="dom-arrowhead" />
                    </marker>
                </defs>
                {arrows.map((arrow) => (
                    <line
                        key={arrow.id}
                        className="dom-arrow"
                        x1={arrow.x1}
                        y1={arrow.y1}
                        x2={arrow.x2}
                        y2={arrow.y2}
                        markerEnd="url(#dom-arrowhead)"
                    />
                ))}
            </svg>
        </div>
    );
};

const EMPTY_NODES: EmptyCellNode[] = CELLS.filter((cell) => !LOCATION_AT.has(coordKey(cell))).map((coordinate) => ({
    id: `empty-${coordinate.row}-${coordinate.col}`,
    type: 'empty',
    position: gridToPixel(coordinate),
    data: { coordinate },
    draggable: false,
    selectable: false,
    focusable: false,
    zIndex: -1,
    width: CARD_SIZE,
    height: CARD_SIZE,
}));

export const FlowPanScreen = ({ moved, onGap }: ScreenProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [instance, setInstance] = useState<ReactFlowInstance<MapNode, MapEdge> | null>(null);
    const flow = useMemo(() => buildFlow(LOCATIONS), []);
    const nodes = useMemo<MapNode[]>(() => [...EMPTY_NODES, ...flow.nodes], [flow]);
    const frameRef = useRef(0);

    const reportGap = useEffectEvent(() => {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(() => {
            const wrapper = wrapperRef.current;
            const edge = flow.edges[0];
            if (!wrapper || !edge || !isHandle(edge.sourceHandle)) return;
            const path = wrapper.querySelector<SVGPathElement>(`.react-flow__edge[data-id="${edge.id}"] .react-flow__edge-path`);
            const card = wrapper.querySelector(`.react-flow__node[data-id="${edge.source}"] .location-card`);
            const matrix = path?.getScreenCTM();
            if (!path || !card || !matrix) return;
            const start = path.getPointAtLength(0);
            const onScreen = new DOMPoint(start.x, start.y).matrixTransform(matrix);
            onGap(gapPx(card, edge.sourceHandle, onScreen));
        });
    });

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    const fitted = useRef(false);
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!instance || !wrapper) return;
        const { fit, moved: movedTarget } = targetsFor(wrapper);
        const target = moved ? movedTarget : fit;
        const first = !fitted.current;
        fitted.current = true;
        void instance
            .setViewport({ x: target.x, y: target.y, zoom: target.scale }, { duration: first ? 0 : DURATION })
            .then(() => {
                if (!first) reportGap();
            });
    }, [instance, moved]);

    return (
        <div ref={wrapperRef} className="flow-viewport">
            <MapFlow
                nodes={nodes}
                edges={flow.edges}
                onInit={setInstance}
                // 코드로 옮긴 경우는 setViewport 뒤에 재므로 사람이 끈 경우만 잰다
                onMoveEnd={(event) => {
                    if (event) reportGap();
                }}
            />
        </div>
    );
};
