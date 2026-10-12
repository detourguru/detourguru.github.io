import { type Coordinate, coordKey, DIRECTIONS } from './grid';

export interface Neighbor {
    id: string;
    name: string;
    coordinate: Coordinate;
    isActivated: boolean;
    isExit: boolean;
}

export interface Location {
    id: string;
    name: string;
    areaId: string;
    coordinate: Coordinate;
    neighbors: Neighbor[];
}

export interface AreaNeighbors {
    locationId: string;
    neighbors: Neighbor[];
}

interface SeedLocation {
    id: string;
    name: string;
    areaId: string;
    coordinate: Coordinate;
}

interface ExitLink {
    fromId: string;
    toId: string;
    slotOnFromArea: Coordinate;
    slotOnToArea: Coordinate;
}

interface MapSeed {
    locations: SeedLocation[];
    exits?: ExitLink[];
}

const createMapData = ({ locations: seedLocations, exits = [] }: MapSeed) => {
    const byId = new Map(seedLocations.map((loc) => [loc.id, loc]));
    const findAt = (areaId: string, coordinate: Coordinate) =>
        seedLocations.find((loc) => loc.areaId === areaId && coordKey(loc.coordinate) === coordKey(coordinate));

    const neighborsOf = (loc: SeedLocation): Neighbor[] => {
        const result: Neighbor[] = [];
        for (const [dr, dc] of DIRECTIONS) {
            const other = findAt(loc.areaId, { row: loc.coordinate.row + dr, col: loc.coordinate.col + dc });
            if (other) result.push({ id: other.id, name: other.name, coordinate: other.coordinate, isActivated: true, isExit: false });
        }
        for (const exit of exits) {
            const otherId = exit.fromId === loc.id ? exit.toId : exit.toId === loc.id ? exit.fromId : null;
            const other = otherId ? byId.get(otherId) : undefined;
            if (!other) continue;
            const slot = exit.fromId === loc.id ? exit.slotOnFromArea : exit.slotOnToArea;
            result.push({ id: other.id, name: other.name, coordinate: slot, isActivated: true, isExit: true });
        }
        return result;
    };

    const locations: Location[] = seedLocations.map((loc) => ({ ...loc, neighbors: neighborsOf(loc) }));

    const areaNeighbors = (areaId: string): AreaNeighbors[] =>
        seedLocations
            .filter((loc) => loc.areaId === areaId)
            .map((loc) => ({ locationId: loc.id, neighbors: neighborsOf(loc) }));

    return { locations, areaNeighbors };
};

export const panMap = createMapData({
    locations: [
        { id: 'well', name: '우물', areaId: 'village', coordinate: { row: 0, col: 1 } },
        { id: 'plaza', name: '광장', areaId: 'village', coordinate: { row: 1, col: 1 } },
        { id: 'market', name: '시장', areaId: 'village', coordinate: { row: 1, col: 2 } },
        { id: 'gate', name: '성문', areaId: 'village', coordinate: { row: 2, col: 2 } },
        { id: 'lake', name: '호숫가', areaId: 'village', coordinate: { row: 2, col: 0 } },
    ],
});

// 숲 장소 좌표가 마을의 시장, 성문 칸과 겹쳐야 잘못 생긴 화살표가 재현된다
export const VILLAGE_ID = 'village';
export const areaMap = createMapData({
    locations: [
        { id: 'well', name: '우물', areaId: VILLAGE_ID, coordinate: { row: 0, col: 1 } },
        { id: 'plaza', name: '광장', areaId: VILLAGE_ID, coordinate: { row: 1, col: 1 } },
        { id: 'market', name: '시장', areaId: VILLAGE_ID, coordinate: { row: 1, col: 2 } },
        { id: 'gate', name: '성문', areaId: VILLAGE_ID, coordinate: { row: 2, col: 2 } },
        { id: 'forest-gate', name: '숲 입구', areaId: 'forest', coordinate: { row: 1, col: 1 } },
        { id: 'lake', name: '호숫가', areaId: 'forest', coordinate: { row: 1, col: 2 } },
        { id: 'cave', name: '동굴', areaId: 'forest', coordinate: { row: 2, col: 2 } },
    ],
    exits: [{ fromId: 'plaza', toId: 'forest-gate', slotOnFromArea: { row: 1, col: 0 }, slotOnToArea: { row: 1, col: 0 } }],
});
