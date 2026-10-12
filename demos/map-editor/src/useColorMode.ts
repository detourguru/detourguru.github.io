import { useSyncExternalStore } from 'react';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

const subscribe = (onChange: () => void) => {
    const media = query();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
};

const getSnapshot = (): 'light' | 'dark' => {
    const fixed = document.documentElement.dataset.theme;
    if (fixed === 'dark' || fixed === 'light') return fixed;
    return query().matches ? 'dark' : 'light';
};

export const useColorMode = () => useSyncExternalStore(subscribe, getSnapshot, () => 'light' as const);
