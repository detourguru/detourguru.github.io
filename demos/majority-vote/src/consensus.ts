export type Casting = Record<string, string[]>;

export type Vote = { value: string[]; count: number };

const serializeCastingValue = (actors: string[]) => [...actors].sort().join('\u0000');

export function pickMostCommonValue<T>(values: T[], toKey: (value: T) => string = (value) => JSON.stringify(value)) {
    const counts = new Map<string, { count: number; value: T }>();

    for (const value of values) {
        const key = toKey(value);
        const current = counts.get(key);

        if (current) current.count += 1;
        else counts.set(key, { count: 1, value });
    }

    return [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
}

export const voteCasting = (runs: Casting[], threshold: number) => {
    const roleNames = new Set(runs.flatMap((casting) => Object.keys(casting)));
    const casting: Casting = {};
    const unsureRoles: string[] = [];
    const best: Record<string, Vote | null> = {};

    for (const role of roleNames) {
        const votes = runs.map((run) => run[role]).filter((actors): actors is string[] => Array.isArray(actors));
        const top = pickMostCommonValue(votes, serializeCastingValue);

        best[role] = top;
        if (top && top.count >= threshold) casting[role] = [...top.value];
        else unsureRoles.push(role);
    }

    return { casting, unsureRoles, best };
};

export type Outcome =
    | { kind: 'failed' }
    | { kind: 'single'; index: number; casting: Casting }
    | { kind: 'vote'; threshold: number; casting: Casting; unsureRoles: string[]; best: Record<string, Vote | null> };

export const combine = (arrived: { index: number; casting: Casting }[], threshold: number): Outcome => {
    if (arrived.length === 0) return { kind: 'failed' };
    if (arrived.length === 1) return { kind: 'single', index: arrived[0].index, casting: arrived[0].casting };

    const effectiveThreshold = Math.min(threshold, arrived.length);

    return {
        kind: 'vote',
        threshold: effectiveThreshold,
        ...voteCasting(
            arrived.map(({ casting }) => casting),
            effectiveThreshold,
        ),
    };
};
