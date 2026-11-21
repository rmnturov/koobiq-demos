/**
 * Скриптовый API сцены: то, чем сценарий управляет демо.
 *
 * Скрипт — обычная `async`-функция, которая получает `Act` и описывает «что и когда»:
 * `put` меняет состояние, `move`/`click` водят курсор, `key` показывает кепки. Всё
 * время идёт через `Clock`, поэтому пауза плеера замораживает и ожидания, и твины.
 *
 * Курсором владеет `Act`: первый вход в сцену — `enter`, он ведёт курсор к первой
 * цели из точки покоя, которая лежит внутри кадра. Курсор не появляется из-за края и
 * не исчезает по дороге: он видим всё время, пока сцена в кадре, — в том числе между
 * шагами. Гаснет он вместе со сценой в разрыве петли, а не по собственному таймеру.
 *
 * Ожидание внутри `Act` считается кадрами, а не таймером: так пауза, замедление и
 * тесты с подставными часами ведут себя одинаково, а шаг анимации совпадает с кадром.
 * Неблокирующие отложенные действия (гашение кепок) идут через `clock.timeout`.
 *
 * Отмена: скрипт получает `AbortSignal`; любой `await` проверяет его и бросает
 * `Stopped`. Нажатие при этом снимается, кепки гаснут — сцена не остаётся в
 * промежуточном состоянии.
 */

import { Clock } from './clock';
import {
    CursorKind,
    Point,
    Rect,
    Target,
    cursorKindAt,
    hoverChain,
    rectOf,
    resolveTarget,
    targetElement
} from './measure';

/** Изменение состояния: патч или функция от текущего состояния. */
export type Patch<S> = Partial<S> | ((state: S) => Partial<S>);

/** Кепки клавиш: какое комбо, показано ли оно и нажато ли (подсветка). */
export interface KeyState {
    combo: string;
    show: boolean;
    down: boolean;
}

/** Сценарий демо. Новый запуск получает свой `Act` и свой сигнал. */
export type Script<S> = (act: Act<S>) => Promise<void>;

export interface Act<S> {
    /** Сигнал запуска: вне очереди его не отменить, им пользуется сцена. */
    readonly signal: AbortSignal;

    /** Меняет состояние без ожидания. */
    put(patch: Patch<S>): void;

    /** Меняет состояние и ждёт два кадра: замеры и `data-hover` становятся свежими. */
    set(patch: Patch<S>): Promise<void>;

    /** Пауза через часы: замирает вместе со сценой. */
    wait(ms: number): Promise<void>;

    /** Печатает текст по символу, обновляя состояние префиксами. */
    type(key: keyof S & string, text: string, opts?: { interval?: number }): Promise<void>;

    /** Ведёт курсор к цели по неглубокой дуге. */
    move(to: Target, opts?: { duration?: number }): Promise<void>;

    /** Клик по цели (или по текущей точке): наведение, пауза, нажатие, отпускание. */
    click(to?: Target): Promise<void>;

    /**
     * Выделение перетаскиванием: нажатие в `from`, рука ведёт до `to`, отпускание.
     * `step` получает прогресс 0…1 на каждом кадре — по нему растёт подсветка.
     */
    drag(from: Target, to: Target, step: (t: number) => void, opts?: { duration?: number }): Promise<void>;

    /** Показывает кепки комбо: показ, нажатие, отпускание, гашение. */
    /** Показывает кепки сочетания; `null` убирает их: шаг без клавиш гасит чужие. */
    key(combo: string | null): Promise<void>;

    /** Ставит курсор в цель мгновенно, без анимации. */
    place(to: Target): void;

    /** Вводит курсор из-за ближайшего края сцены. */
    enter(to: Target): Promise<void>;

    /** Меняет состояние без переходов: только за визуальным разрывом. */
    snap(patch: Patch<S>): Promise<void>;

    /** Прямоугольник цели в пикселях сцены; неизвестная цель — пустой прямоугольник. */
    rect(name: Target): Rect;
}

/** Всё, чем владеет сцена и что `Act` только приводит в движение. */
export interface ActEnv<S> {
    root: HTMLElement;
    cursor: HTMLElement | null;
    signal: AbortSignal;
    clock: Clock;
    state: () => S;
    put(patch: Patch<S>): void;
    setKind(kind: CursorKind): void;
    setKeys(keys: KeyState | null): void;
    scale: () => number;
    /** Позиция курсора в пикселях сцены; объект общий со сценой и мутируется на месте. */
    pos: Point;
    ripple(point: Point): void;
}

/** Остановка скрипта: не ошибка, а конец запуска. */
export class Stopped extends Error {
    constructor(message = 'script stopped') {
        super(message);
        this.name = 'Stopped';
    }
}

/** Интервал печати по умолчанию. */
const TYPE_INTERVAL = 110;

/** Пауза после наведения перед нажатием и длина нажатия. */
const CLICK_SETTLE = 120;
const PRESS_HOLD = 100;

/** Выделение: скорость руки по строке и границы длительности. */
const DRAG_PER_PX = 2.4;
const DRAG_MIN = 320;
const DRAG_MAX = 900;

/** Кепки: показ, нажатие, сколько висят после отпускания. */
const KEY_SHOW = 180;
const KEY_DOWN = 140;
const KEY_HOLD = 600;

/** Вход курсора в сцену: путь из точки покоя к первой цели. */
const ENTER_MS = 700;

/** Дуга и длительность перемещения: длинные пути не должны тянуться. */
const BOW_RATIO = 0.08;
const BOW_MAX = 24;
const DURATION_BASE = 260;
const DURATION_PER_PX = 0.9;
const DURATION_MIN = 300;
const DURATION_MAX = 650;

/** Путь короче этого — не перемещение, а только наведение. */
const MIN_PATH = 0.5;

/** Точность координат сцены: та же, что у замеров. */
const PRECISION = 100;

/** Идентификатор «таймера нет»: `clearTimeout(0)` безопасен. */
const NO_TIMER = 0;

/** Что считается целью наведения: то же, что в замерах. */
const HOVERABLE = '[data-target], button, a[href], [role="button"]';

/** Служебные слои сцены не участвуют в попадании. */
const SERVICE = '.stage__cursor, .stage__keys';

const tidy = (value: number): number => Math.round(value * PRECISION) / PRECISION;

const safeScale = (scale: number): number => (Number.isFinite(scale) && scale > 0 ? scale : 1);

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

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

export function createAct<S>(env: ActEnv<S>): Act<S> {
    const { root, cursor, signal, clock, pos } = env;

    /** Цепь наведения, которая сейчас висит на сцене. */
    let chain: Element[] = [];
    /** Элемент, который сейчас нажат. */
    let pressed: Element | null = null;
    /** Вид курсора, который сейчас показан. */
    let kind: CursorKind | null = null;
    /** Последнее комбо и таймер его гашения. */
    let held: string | null = null;
    let clearTimer = NO_TIMER;

    const scale = (): number => safeScale(env.scale());

    const guard = (): void => {
        if (signal.aborted) {
            throw new Stopped();
        }
    };

    /**
     * Ожидание, снимаемое отменой: `schedule(done)` запускает работу и возвращает
     * функцию отмены. Abort и отменяет работу, и отклоняет ожидание `Stopped`.
     */
    const pause = (schedule: (done: () => void) => () => void): Promise<void> =>
        new Promise<void>((resolve, reject) => {
            if (signal.aborted) {
                reject(new Stopped());
                return;
            }

            let cancel: () => void = () => {};
            let settled = false;

            const settle = (): void => {
                settled = true;
                signal.removeEventListener('abort', onAbort);
            };

            const onAbort = (): void => {
                cancel();
                settled = true;
                reject(new Stopped());
            };

            cancel = schedule(() => {
                if (settled) {
                    return;
                }

                settle();
                resolve();
            });

            if (settled) {
                return;
            }

            signal.addEventListener('abort', onAbort, { once: true });

            if (signal.aborted) {
                onAbort();
            }
        });

    /** Один кадр сцены. */
    const frame = (): Promise<void> =>
        pause((done) => {
            let id = NO_TIMER;

            id = clock.raf(done);

            return () => clock.cancelRaf(id);
        });

    /** Твин по кадрам: `step` получает прогресс 0…1, последний шаг — ровно 1. */
    const tween = (ms: number, step: (t: number) => void): Promise<void> =>
        pause((done) => {
            const start = clock.now();
            let id = NO_TIMER;

            const tick = (): void => {
                guard();

                const progress = ms > 0 ? (clock.now() - start) / ms : 1;

                if (progress >= 1) {
                    step(1);
                    done();
                    return;
                }

                step(easeInOutCubic(progress));
                id = clock.raf(tick);
            };

            id = clock.raf(tick);

            return () => clock.cancelRaf(id);
        });

    /** Ожидание, идущее кадрами: твин без шага. */
    const wait = (ms: number): Promise<void> => tween(ms, () => {});

    const drawCursor = (): void => {
        if (!cursor) {
            return;
        }

        cursor.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    };

    /** Элемент под точкой сцены: стек окна, а без него — самый маленький прямоугольник. */
    const candidate = (point: Point): Element | null => {
        const box = root.getBoundingClientRect();
        const k = scale();
        const hit = stackAt(box.left + point.x * k, box.top + point.y * k).find(
            (element) => root.contains(element) && !element.closest(SERVICE)
        );

        if (hit) {
            return hit;
        }

        let best: { element: Element; area: number } | null = null;

        for (const element of root.querySelectorAll(HOVERABLE)) {
            if (element.closest(SERVICE)) {
                continue;
            }

            const rect = rectOf(root, element, k);
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

    /** Снимает наведение со всей прошлой цепи. */
    const dropHover = (): void => {
        for (const element of chain) {
            element.removeAttribute('data-hover');
            element.classList.remove('kbq-hover');
        }

        chain = [];
    };

    /** Наведение: снимает прошлую цепь и вешает состояния на новую. */
    const hover = (point: Point): void => {
        const next = hoverChain(root, candidate(point));
        const same =
            next.length === chain.length &&
            next.every((element, index) => element === chain[index]);

        if (same) {
            return;
        }

        dropHover();

        for (const element of next) {
            element.setAttribute('data-hover', '');
            element.classList.add('kbq-hover');
        }

        chain = next;
    };

    const release = (): void => {
        pressed?.classList.remove('kbq-active');
        pressed?.removeAttribute('data-pressed');
        pressed = null;
        cursor?.removeAttribute('data-pressed');
    };

    /**
     * Нажатие: Koobiq-состояние на цели и `data-pressed` на курсоре.
     * Волна остаётся у клика: у перетаскивания это выделение, а не нажатие кнопки.
     */
    const press = (ripple = true): void => {
        release();

        const target = hoverChain(root, candidate(pos)).at(-1) ?? null;

        if (target) {
            target.classList.add('kbq-active');
            target.setAttribute('data-pressed', '');
        }

        pressed = target;
        cursor?.setAttribute('data-pressed', '');

        if (ripple) {
            env.ripple({ x: pos.x, y: pos.y });
        }
    };

    const refresh = (): void => {
        const next = cursorKindAt(root, pos, scale(), 'default');

        if (next !== kind) {
            kind = next;
            env.setKind(next);
        }

        hover(pos);
    };

    const setPos = (x: number, y: number): void => {
        pos.x = tidy(x);
        pos.y = tidy(y);
        drawCursor();
        refresh();
    };

    /**
     * Ведёт курсор из `from` (по умолчанию из текущей точки) по дуге в `to`.
     *
     * `from` может быть тем же объектом, что и `pos` (`move`/`click` ведут из текущей
     * точки), а `setPos` мутирует `pos` на месте. Поэтому начало снимается в числа
     * до первого шага: иначе `from` «уезжает» вместе с курсором, и каждый кадр
     * считается от предыдущего — путь расходится, курсор улетает за сцену.
     */
    const travel = (to: Point, from: Point = pos, duration?: number): Promise<void> => {
        const startX = from.x;
        const startY = from.y;
        const dx = to.x - startX;
        const dy = to.y - startY;
        const distance = Math.hypot(dx, dy);

        setPos(startX, startY);

        if (distance < MIN_PATH) {
            setPos(to.x, to.y);
            return Promise.resolve();
        }

        const ms =
            duration ??
            clamp(DURATION_BASE + distance * DURATION_PER_PX, DURATION_MIN, DURATION_MAX);
        const bow = Math.min(distance * BOW_RATIO, BOW_MAX);
        // Нормаль к пути, направленная вверх: дуга не уводит курсор под цель.
        const nx = dy / distance;
        const ny = -dx / distance;
        const sway = (t: number): number => Math.sin(Math.PI * t) * bow;

        return tween(ms, (t) => {
            setPos(startX + dx * t + nx * sway(t), startY + dy * t + ny * sway(t));
        }).then(() => setPos(to.x, to.y));
    };

    const move = async (to: Target, opts?: { duration?: number }): Promise<void> => {
        guard();

        const point = resolveTarget(root, to, scale());

        if (!point) {
            return;
        }

        await travel(point, pos, opts?.duration);
    };

    const click = async (to?: Target): Promise<void> => {
        guard();

        if (to === undefined) {
            refresh();
        } else {
            const point = resolveTarget(root, to, scale());

            if (!point) {
                return;
            }

            await travel(point);
        }

        guard();
        await wait(CLICK_SETTLE);

        press();

        try {
            await wait(PRESS_HOLD);
        } finally {
            release();
        }
    };

    /**
     * Выделение перетаскиванием: подойти к `from`, нажать, повести руку к `to`
     * и отпустить. Курсор нажат всё время пути, поэтому и остаётся кареткой.
     */
    const drag = async (
        from: Target,
        to: Target,
        step: (t: number) => void,
        opts?: { duration?: number }
    ): Promise<void> => {
        guard();

        const start = resolveTarget(root, from, scale());
        const end = resolveTarget(root, to, scale());

        if (!start || !end) {
            return;
        }

        await travel(start, pos);
        guard();
        await wait(CLICK_SETTLE);

        press(false);

        try {
            const distance = Math.hypot(end.x - start.x, end.y - start.y);
            const ms = opts?.duration ?? clamp(distance * DRAG_PER_PX, DRAG_MIN, DRAG_MAX);

            await tween(ms, (t) => {
                setPos(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
                step(t);
            });
        } finally {
            release();
        }
    };

    const typeText = async (
        key: keyof S & string,
        text: string,
        opts?: { interval?: number }
    ): Promise<void> => {
        guard();

        const interval = opts?.interval ?? TYPE_INTERVAL;

        for (let i = 1; i <= text.length; i++) {
            env.put({ [key]: text.slice(0, i) } as Patch<S>);
            refresh();

            if (i < text.length) {
                await wait(interval);
            }
        }
    };

    const pressKey = async (combo: string | null): Promise<void> => {
        guard();

        if (combo === null) {
            held = null;

            if (clearTimer !== NO_TIMER) {
                clock.clearTimeout(clearTimer);
                clearTimer = NO_TIMER;
            }

            env.setKeys(null);

            return;
        }

        held = combo;
        clock.clearTimeout(clearTimer);
        clearTimer = NO_TIMER;

        env.setKeys({ combo, show: true, down: false });
        await wait(KEY_SHOW);

        env.setKeys({ combo, show: true, down: true });
        await wait(KEY_DOWN);

        env.setKeys({ combo, show: true, down: false });

        clearTimer = clock.timeout(() => {
            // Новый запуск мог занять кепки своими: гасим только свои.
            if (signal.aborted || held !== combo) {
                return;
            }

            env.setKeys(null);
        }, KEY_HOLD);
    };

    const snap = async (patch: Patch<S>): Promise<void> => {
        guard();

        root.setAttribute('data-instant', '');

        try {
            env.put(patch);
            await frame();
            await frame();
        } finally {
            root.removeAttribute('data-instant');
        }
    };

    const set = async (patch: Patch<S>): Promise<void> => {
        guard();

        env.put(patch);
        await frame();
        await frame();
        refresh();
    };

    const place = (to: Target): void => {
        const point = resolveTarget(root, to, scale());

        if (!point) {
            return;
        }

        setPos(point.x, point.y);
    };

    const enter = async (to: Target): Promise<void> => {
        guard();

        const point = resolveTarget(root, to, scale());

        if (!point) {
            return;
        }

        // Точка покоя лежит внутри кадра: курсор идёт к цели, а не появляется из-за края.
        await travel(point, undefined, ENTER_MS);
    };

    const rect = (name: Target): Rect => {
        const element = targetElement(root, name);

        return element ? rectOf(root, element, scale()) : { ...EMPTY_RECT };
    };

    // Отмена снимает всё, что сцена показывает поверх продукта.
    signal.addEventListener(
        'abort',
        () => {
            dropHover();
            release();
            env.setKeys(null);
        },
        { once: true }
    );

    return {
        signal,
        put: (patch) => env.put(patch),
        set,
        wait,
        type: typeText,
        move,
        click,
        drag,
        key: pressKey,
        place,
        enter,
        snap,
        rect
    };
}
