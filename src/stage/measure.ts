/**
 * Геометрия сцены: цели, их прямоугольники и вид курсора под точкой.
 *
 * Всё здесь — чистые функции над DOM: ни Angular, ни состояния. Координаты живут
 * в системе сцены — дизайнерских пикселях до масштабирования, поэтому `scale`
 * (см. `.stage-fit`) делит измерения, снятые с окна.
 */

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Цель скрипта: имя `[data-target]` или имя плюс доли его прямоугольника. */
export type Target = string | { at: string; x?: number; y?: number };

export type CursorKind = 'default' | 'ibeam' | 'hand';

/** Что считается «размеченным» для наведения: цели и сами контролы. */
const MARKED = '[data-cursor], button, a[href], [role="button"]';

/** Цели сцены: всё, что скрипт может адресовать и на что вешается `data-hover`. */
const HOVERABLE = '[data-target], button, a[href], [role="button"]';

/** Служебные слои сцены: курсор и клавиши не участвуют в попадании. */
const SERVICE = '.stage__cursor, .stage__keys';

const CURSOR_KINDS: readonly CursorKind[] = ['default', 'ibeam', 'hand'];

/** Доли по умолчанию — центр прямоугольника. */
const CENTER = 0.5;

/** Точность координат сцены: субпиксель с запасом, без мусора float-арифметики. */
const PRECISION = 100;

const tidy = (value: number): number => Math.round(value * PRECISION) / PRECISION;

/** Масштаб, пригодный для деления: во время первой раскладки он может быть 0/NaN. */
const safeScale = (scale: number): number => (Number.isFinite(scale) && scale > 0 ? scale : 1);

const parseTarget = (target: Target): { at: string; x: number; y: number } =>
    typeof target === 'string'
        ? { at: target, x: CENTER, y: CENTER }
        : { at: target.at, x: target.x ?? CENTER, y: target.y ?? CENTER };

/**
 * Элемент цели по имени. Неизвестная цель — предупреждение и `null`:
 * скрипт продолжает работу, но в консоли видно опечатку.
 */
export function targetElement(root: HTMLElement, target: Target): HTMLElement | null {
    const { at } = parseTarget(target);

    for (const element of root.querySelectorAll<HTMLElement>('[data-target]')) {
        if (element.getAttribute('data-target') === at) {
            return element;
        }
    }

    console.warn(`no data-target="${at}"`);

    return null;
}

/** Прямоугольник элемента в пикселях сцены: снятый с окна размер делится на масштаб. */
export function rectOf(root: HTMLElement, element: Element, scale: number): Rect {
    const box = root.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const k = safeScale(scale);

    return {
        x: tidy((rect.left - box.left) / k),
        y: tidy((rect.top - box.top) / k),
        width: tidy(rect.width / k),
        height: tidy(rect.height / k)
    };
}

/** Точка внутри цели: `at` плюс доли её прямоугольника (`x`, `y` от 0 до 1). */
export function resolveTarget(root: HTMLElement, target: Target, scale: number): Point | null {
    const element = targetElement(root, target);

    if (!element) {
        return null;
    }

    const { x, y } = parseTarget(target);
    const rect = rectOf(root, element, scale);

    return { x: tidy(rect.x + rect.width * x), y: tidy(rect.y + rect.height * y) };
}

const kindOf = (element: Element): CursorKind => {
    const marked = element.getAttribute('data-cursor') as CursorKind | null;

    if (marked && CURSOR_KINDS.includes(marked)) {
        return marked;
    }

    return element.matches('button, a[href], [role="button"]') ? 'hand' : 'default';
};

/** Ближайший размеченный элемент на пути вверх, не выходя за пределы сцены. */
const nearestMarked = (element: Element | null, root: HTMLElement): Element | null => {
    for (let node = element; node; node = node.parentElement) {
        if (node.matches(MARKED)) {
            return node;
        }

        if (node === root) {
            return null;
        }
    }

    return null;
};

/** Стек элементов под точкой окна; в jsdom `elementsFromPoint` нет. */
const stackAt = (x: number, y: number): Element[] => {
    if (typeof document.elementsFromPoint !== 'function') {
        return [];
    }

    try {
        return document.elementsFromPoint(x, y);
    } catch {
        return [];
    }
};

/** Запасной путь без `elementsFromPoint`: самый маленький размеченный прямоугольник. */
const markedAt = (root: HTMLElement, point: Point, scale: number): Element | null => {
    let best: { element: Element; area: number } | null = null;

    for (const element of root.querySelectorAll(MARKED)) {
        if (element.closest(SERVICE)) {
            continue;
        }

        const rect = rectOf(root, element, scale);
        const inside =
            point.x >= rect.x &&
            point.x <= rect.x + rect.width &&
            point.y >= rect.y &&
            point.y <= rect.y + rect.height;

        if (!inside) {
            continue;
        }

        const area = rect.width * rect.height;

        if (!best || area < best.area) {
            best = { element, area };
        }
    }

    return best?.element ?? null;
};

/**
 * Вид курсора в точке сцены: берётся с ближайшего размеченного элемента под ней,
 * иначе — `base` (вид «по умолчанию» для этого места сцены).
 */
export function cursorKindAt(
    root: HTMLElement,
    point: Point,
    scale: number,
    base: CursorKind
): CursorKind {
    const box = root.getBoundingClientRect();
    const k = safeScale(scale);
    const stack = stackAt(box.left + point.x * k, box.top + point.y * k);
    const hit = stack.find((element) => root.contains(element) && !element.closest(SERVICE));

    if (hit) {
        const marked = nearestMarked(hit, root);

        return marked ? kindOf(marked) : base;
    }

    const marked = markedAt(root, point, scale);

    return marked ? kindOf(marked) : base;
}

/**
 * Цепь наведения: размеченные предки элемента и сами контролы, от внешнего
 * к внутреннему. Koobiq вешает `.kbq-hover` на кнопку, даже если кнопка не цель,
 * поэтому контролы попадают в цепь наравне с `[data-target]`.
 */
export function hoverChain(root: HTMLElement, element: Element | null): Element[] {
    if (!element || !root.contains(element)) {
        return [];
    }

    const chain: Element[] = [];

    let node: Element | null = element;

    while (node && node !== root) {
        if (node.matches(HOVERABLE)) {
            chain.push(node);
        }

        node = node.parentElement;
    }

    return chain.reverse();
}
