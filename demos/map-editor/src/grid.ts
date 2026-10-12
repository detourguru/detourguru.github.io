export const CARD_SIZE = 120;
export const GRID_GAP = 40;
export const CELL = CARD_SIZE + GRID_GAP;

export interface Coordinate {
    row: number;
    col: number;
}

export type HandleId =
    | 'top'
    | 'top-right'
    | 'right'
    | 'bottom-right'
    | 'bottom'
    | 'bottom-left'
    | 'left'
    | 'top-left';

export const DIRECTIONS: readonly (readonly [number, number])[] = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
];

export const cardId = ({ row, col }: Coordinate) => `card-${row}-${col}`;

export const coordKey = ({ row, col }: Coordinate) => `${row},${col}`;

export const gridToPixel = ({ row, col }: Coordinate) => ({
    x: col * CELL,
    y: row * CELL,
});

const ANCHORS: Record<string, readonly [HandleId, HandleId]> = {
    '0,1': ['right', 'left'],
    '0,-1': ['left', 'right'],
    '1,0': ['bottom', 'top'],
    '-1,0': ['top', 'bottom'],
    '-1,1': ['top-right', 'bottom-left'],
    '-1,-1': ['top-left', 'bottom-right'],
    '1,1': ['bottom-right', 'top-left'],
    '1,-1': ['bottom-left', 'top-right'],
};

export const getAnchorCoordinates = (from: Coordinate, to: Coordinate) => {
    const key = `${Math.sign(to.row - from.row)},${Math.sign(to.col - from.col)}`;
    const [sourceHandle, targetHandle] = ANCHORS[key] ?? ['right', 'left'];
    return { sourceHandle, targetHandle };
};

export interface Transform {
    x: number;
    y: number;
    scale: number;
}

export const gridExtent = (coordinates: readonly Coordinate[]) => {
    const rows = Math.max(...coordinates.map((c) => c.row)) + 1;
    const cols = Math.max(...coordinates.map((c) => c.col)) + 1;
    return { rows, cols, width: cols * CELL - GRID_GAP, height: rows * CELL - GRID_GAP };
};

const FIT_PADDING = 36;

export const fitTransform = (viewWidth: number, viewHeight: number, width: number, height: number): Transform => {
    const scale = Math.min((viewWidth - FIT_PADDING * 2) / width, (viewHeight - FIT_PADDING * 2) / height, 1);
    return { x: (viewWidth - width * scale) / 2, y: (viewHeight - height * scale) / 2, scale };
};

export const movedTransform = (base: Transform, viewWidth: number, viewHeight: number): Transform => {
    const zoom = 1.15;
    const cx = viewWidth / 2;
    const cy = viewHeight / 2;
    return {
        scale: base.scale * zoom,
        x: cx - (cx - base.x) * zoom + viewWidth * 0.08,
        y: cy - (cy - base.y) * zoom + viewHeight * 0.04,
    };
};
