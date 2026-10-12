import { createContext, useContext } from 'react';

// 컴포넌트 안에 두면 가상화가 언마운트할 때 기록도 사라지므로 밖에 둔다
export type MountRegistry = {
    playedEntryIds: Set<string>;
    loadedImageIds: Set<string>;
    reset: () => void;
};

export const createMountRegistry = (): MountRegistry => {
    const playedEntryIds = new Set<string>();
    const loadedImageIds = new Set<string>();
    return {
        playedEntryIds,
        loadedImageIds,
        reset: () => {
            playedEntryIds.clear();
            loadedImageIds.clear();
        },
    };
};

export const MountRegistryContext = createContext<MountRegistry | null>(null);

export const useMountRegistry = () => {
    const registry = useContext(MountRegistryContext);
    if (!registry) throw new Error('MountRegistryContext 안에서만 쓸 수 있습니다');
    return registry;
};
