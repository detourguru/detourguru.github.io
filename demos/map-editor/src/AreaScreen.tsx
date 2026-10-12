import { buildFlow } from './flow';
import type { Coordinate } from './grid';
import { FIT_OPTIONS, MapFlow } from './MapFlow';
import { areaMap, type Location, VILLAGE_ID } from './mapData';

export type Version = 'before' | 'after';

const mergeLocations = (version: Version): Location[] => {
    const allLocations = areaMap.locations;
    const areaNeighbors = areaMap.areaNeighbors(VILLAGE_ID);
    const locationIdList = areaNeighbors.map((item) => item.locationId);
    const neighborIdList = areaNeighbors.flatMap((item) => item.neighbors.map((n) => n.id));

    const neighborMap = new Map<string, Coordinate>();
    areaNeighbors.forEach((item) => item.neighbors.forEach((n) => neighborMap.set(n.id, n.coordinate)));
    const placeOnThisMap = (loc: Location): Location => ({ ...loc, coordinate: neighborMap.get(loc.id) ?? loc.coordinate });

    if (version === 'before') {
        const locations = allLocations.filter((loc) => locationIdList.includes(loc.id));
        const neighbors = allLocations.filter((loc) => neighborIdList.includes(loc.id)).map(placeOnThisMap);
        return [...locations, ...neighbors];
    }

    const uniqueIdSet = new Set([...neighborIdList, ...locationIdList]);
    return allLocations
        .filter((loc) => uniqueIdSet.has(loc.id))
        .map(placeOnThisMap)
        .map((loc) => (loc.areaId !== VILLAGE_ID ? { ...loc, neighbors: [] } : loc));
};

export const AREA_FLOWS: Record<Version, ReturnType<typeof buildFlow>> = {
    before: buildFlow(mergeLocations('before'), { currentAreaId: VILLAGE_ID }),
    after: buildFlow(mergeLocations('after'), { currentAreaId: VILLAGE_ID }),
};

export const AreaScreen = ({ version }: { version: Version }) => {
    const { nodes, edges } = AREA_FLOWS[version];
    return (
        <div className="flow-viewport">
            <MapFlow nodes={nodes} edges={edges} fitView fitViewOptions={FIT_OPTIONS} />
        </div>
    );
};
