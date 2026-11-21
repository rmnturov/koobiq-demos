import { cursorKindAt, hoverChain, rectOf, resolveTarget, targetElement } from './measure';

function box(el: HTMLElement, x: number, y: number, width: number, height: number): HTMLElement {
    el.getBoundingClientRect = () => ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height, toJSON: () => ({}) }) as DOMRect;
    return el;
}

function stage(): HTMLElement {
    const root = document.createElement('div');
    box(root, 0, 0, 720, 400);
    root.innerHTML = '<div data-target="field" data-cursor="ibeam"><button data-cursor="hand"></button></div>';
    const field = root.querySelector('[data-target="field"]') as HTMLElement;
    box(field, 100, 50, 200, 40);
    const button = field.querySelector('button') as HTMLElement;
    box(button, 110, 60, 40, 20);
    return root;
}

/**
 * jsdom не имеет `elementsFromPoint`, поэтому браузерный путь проверяется подменой:
 * стаб отдаёт заданный стек и записывает, в каких координатах окна его спросили.
 */
function stubElementsFromPoint(stack: Element[]): { calls: [number, number][]; restore: () => void } {
    const calls: [number, number][] = [];

    Object.assign(document, {
        elementsFromPoint: (x: number, y: number) => {
            calls.push([x, y]);
            return stack;
        }
    });

    return { calls, restore: () => Reflect.deleteProperty(document, 'elementsFromPoint') };
}

describe('measure', () => {
    it('resolves a target point in fractions of its rect', () => {
        const root = stage();
        expect(resolveTarget(root, { at: 'field', x: 0, y: 0.5 }, 1)).toEqual({ x: 100, y: 70 });
        expect(resolveTarget(root, 'field', 1)).toEqual({ x: 200, y: 70 });
    });

    it('returns null for an unknown target', () => {
        expect(resolveTarget(stage(), 'nope', 1)).toBeNull();
        expect(targetElement(stage(), 'nope')).toBeNull();
    });

    it('warns about an unknown target', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            expect(targetElement(stage(), 'nope')).toBeNull();
            expect(warn).toHaveBeenCalledWith('no data-target="nope"');
        } finally {
            warn.mockRestore();
        }
    });

    it('measures a rect in stage pixels under scale', () => {
        const root = document.createElement('div');
        box(root, 10, 20, 720, 400);
        root.innerHTML = '<div data-target="field"></div>';
        const field = root.querySelector('[data-target="field"]') as HTMLElement;
        box(field, 110, 70, 400, 80);

        expect(rectOf(root, field, 1)).toEqual({ x: 100, y: 50, width: 400, height: 80 });
        expect(rectOf(root, field, 2)).toEqual({ x: 50, y: 25, width: 200, height: 40 });
        expect(resolveTarget(root, 'field', 2)).toEqual({ x: 150, y: 45 });
    });

    it('takes the kind from the marked element under the point', () => {
        const root = stage();
        expect(cursorKindAt(root, { x: 120, y: 65 }, 1, 'default')).toBe('hand');
        expect(cursorKindAt(root, { x: 250, y: 80 }, 1, 'default')).toBe('ibeam');
        expect(cursorKindAt(root, { x: 600, y: 300 }, 1, 'default')).toBe('default');
    });

    // Браузерный путь: точка сцены переводится в координаты окна, а не передаётся как есть.
    it('asks elementsFromPoint in window coordinates at the stage scale', () => {
        const root = stage();
        const button = root.querySelector('button') as HTMLElement;
        const { calls, restore } = stubElementsFromPoint([button]);

        try {
            // scale 1, сцена в нуле окна: координаты совпадают со сценой
            expect(cursorKindAt(root, { x: 120, y: 65 }, 1, 'default')).toBe('hand');
            expect(calls).toEqual([[120, 65]]);

            // scale 2 и сдвинутая сцена: забытый box.left/top или `/ k` вместо `* k` виден сразу
            box(root, 40, 30, 720, 400);
            expect(cursorKindAt(root, { x: 120, y: 65 }, 2, 'default')).toBe('hand');
            expect(calls[calls.length - 1]).toEqual([40 + 120 * 2, 30 + 65 * 2]);
        } finally {
            restore();
        }
    });

    // Верхний элемент стека может быть без разметки: вид берётся с ближайшего размеченного предка.
    it('lifts an unmarked element under the point up to the marked target', () => {
        const root = stage();
        const field = root.querySelector('[data-target="field"]') as HTMLElement;
        const button = field.querySelector('button') as HTMLElement;
        const label = document.createElement('div');
        label.className = 'kbq-form-field__label';
        field.append(label);

        const insideTarget = stubElementsFromPoint([label]);

        try {
            // точка вне всех размеченных прямоугольников: ответ может прийти только из стека
            expect(cursorKindAt(root, { x: 600, y: 300 }, 1, 'default')).toBe('ibeam');
        } finally {
            insideTarget.restore();
        }

        const glitter = document.createElement('span');
        button.append(glitter);

        const insideControl = stubElementsFromPoint([glitter]);

        try {
            expect(cursorKindAt(root, { x: 600, y: 300 }, 1, 'default')).toBe('hand');
        } finally {
            insideControl.restore();
        }
    });

    it('prefers elementsFromPoint and ignores the cursor and keys layers', () => {
        const root = stage();
        const button = root.querySelector('button') as HTMLElement;
        const cursor = document.createElement('div');
        cursor.className = 'stage__cursor';
        root.append(cursor);

        Object.assign(document, { elementsFromPoint: () => [cursor, button] });

        try {
            expect(cursorKindAt(root, { x: 5, y: 5 }, 1, 'default')).toBe('hand');
        } finally {
            Reflect.deleteProperty(document, 'elementsFromPoint');
        }

        expect(cursorKindAt(root, { x: 5, y: 5 }, 1, 'default')).toBe('default');
    });

    // Цепь включает [data-target] и сами контролы: .kbq-hover нужен и цели, и кнопке.
    it('returns the marked chain up to the stage root', () => {
        const root = stage();
        const button = root.querySelector('button')!;
        expect(hoverChain(root, button).map((el) => el.getAttribute('data-target') ?? el.tagName)).toEqual([
            'field',
            'BUTTON'
        ]);
    });

    it('returns an empty chain for the stage root and for nothing', () => {
        const root = stage();
        expect(hoverChain(root, root)).toEqual([]);
        expect(hoverChain(root, null)).toEqual([]);
        expect(hoverChain(root, document.createElement('button'))).toEqual([]);
    });
});
