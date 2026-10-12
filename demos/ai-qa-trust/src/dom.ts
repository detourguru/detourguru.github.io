import { confirmed, observed, unverified, type Judgement } from './judgement';
import type { Evidence, LocatorResult } from './schema';

export type Role = 'button' | 'link' | 'heading';

export type Locator = { role: Role; name: string | RegExp };

export const roleOf = (el: Element): string | null => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName;
    if (tag === 'BUTTON') return 'button';
    if (tag === 'A' && el.hasAttribute('href')) return 'link';
    if (/^H[1-6]$/.test(tag)) return 'heading';
    return null;
};

export const nameOf = (el: Element): string =>
    (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();

const isVisible = (el: Element): boolean => el.closest('[hidden]') === null && el.getClientRects().length > 0;

export const describe = (loc: Locator): string =>
    `role=${loc.role} name=${typeof loc.name === 'string' ? `"${loc.name}"` : String(loc.name)}`;

export const queryAll = (root: Element, loc: Locator): Element[] =>
    [...root.querySelectorAll('*')].filter((el) => {
        if (roleOf(el) !== loc.role || !isVisible(el)) return false;
        const name = nameOf(el);
        return typeof loc.name === 'string' ? name === loc.name : loc.name.test(name);
    });

export const runLocator = (root: Element, loc: Locator): { result: LocatorResult; elements: Element[] } => {
    const elements = queryAll(root, loc);
    const names = elements.map((el) => `'${nameOf(el)}'`).join(', ');
    return {
        elements,
        result: {
            selector: describe(loc),
            matches: elements.length,
            observed: elements.length === 0 ? '일치 0개' : `일치 ${elements.length}개 (${names})`,
        },
    };
};

export type AbsenceResult = {
    absent: boolean;
    judgement: Judgement;
    results: LocatorResult[];
    found: Element[];
};

export const expectAbsent = (options: {
    id: string;
    label: string;
    root: Element;
    locators: Locator[];
    evidence?: readonly [Evidence, ...Evidence[]];
}): AbsenceResult => {
    if (options.locators.length < 2) throw new Error('expectAbsent: 로케이터 하나만 보고 없다고 하지 않는다');
    const runs = options.locators.map((loc) => runLocator(options.root, loc));
    const results = runs.map((r) => r.result);
    const found = runs.flatMap((r) => r.elements);
    const hits = results.filter((r) => r.matches > 0).map((r) => r.selector);
    if (hits.length > 0) {
        return { absent: false, results, found, judgement: observed(options.id, options.label, `있음 (${hits.join(', ')}로 확인)`) };
    }
    const detail = `로케이터 ${options.locators.length}개 모두에서 못 찾음`;
    return {
        absent: true,
        results,
        found,
        judgement: options.evidence
            ? confirmed(options.id, options.label, detail, options.evidence)
            : unverified(options.id, options.label, `${detail}. 근거가 없어 발견으로 올릴 수 없다`),
    };
};
