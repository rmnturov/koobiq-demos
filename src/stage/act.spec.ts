import { Act, createAct, Stopped } from './act';
import { Point } from './measure';

interface S { value: string }

/**
 * Окружение для тестов.
 *
 * `frames` задаёт часы:
 * - `'sync'` — кадр доигрывается прямо в момент подписки, твин проходит целиком до первого `await`;
 * - `'manual'` — кадры не приходят вовсе, ожидание висит, пока его не снимет abort;
 * - `'queued'` — кадры копятся в очереди, и тест сам пускает их через `flush`.
 *
 * Только `'queued'` показывает середину твина и состояние нажатия: синхронные часы
 * доигрывают весь сценарий до ассертов, и промежуточные состояния не видны.
 */
function env(frames: 'sync' | 'manual' | 'queued' = 'sync') {
    const root = document.createElement('div');
    root.innerHTML = '<div data-target="field" data-cursor="ibeam"></div>';
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 720, height: 400 }) as DOMRect;
    const field = root.querySelector('[data-target="field"]') as HTMLElement;
    field.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 40 }) as DOMRect;
    const cursor = document.createElement('div');
    const controller = new AbortController();
    let state: S = { value: '' };
    const kinds: string[] = [];
    const keys: unknown[] = [];
    const cancelled: number[] = [];
    const queue: Array<() => void> = [];
    let time = 0;
    // 'manual' — часы без кадров: ожидание висит, пока его не снимет abort.
    const clock = {
        raf: (cb: () => void) => {
            if (frames === 'sync') {
                cb();
            } else if (frames === 'queued') {
                queue.push(cb);
            }
            return 1;
        },
        cancelRaf: (id: number) => void cancelled.push(id),
        timeout: (_cb: () => void, _ms: number) => 1,
        clearTimeout: () => {},
        now: () => (frames === 'sync' ? (time += 16) : time),
        pause: () => {},
        resume: () => {},
        dispose: () => {}
    };
    const pos = { x: 0, y: 0 };
    /** Один кадр очереди: время идёт вперёд, затем выполняются накопленные кадры. */
    const flush = async (): Promise<void> => {
        time += 16;
        for (const callback of queue.splice(0)) {
            callback();
        }
        // Отдать микрозадачи: продолжение после `await` ставит следующий кадр.
        await new Promise((resolve) => setTimeout(resolve, 0));
    };
    const act: Act<S> = createAct<S>({
        root,
        cursor,
        signal: controller.signal,
        clock: clock as never,
        state: () => state,
        put: (patch) => (state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }),
        setKind: (kind) => kinds.push(kind),
        setKeys: (value) => keys.push(value),
        scale: () => 1,
        pos,
        ripple: () => {}
    });
    return { act, controller, cursor, field, root, getState: () => state, kinds, keys, cancelled, pos, flush };
}

/** Достаточно кадров на самый длинный сценарий теста: твин, пауза и нажатие. */
const FRAME_LIMIT = 600;

/**
 * Прокручивает кадры очереди, пока обещание не завершится, и запоминает позицию
 * курсора на каждой границе кадра — так виден весь путь, а не только его конец.
 */
async function drive<T>(
    promise: Promise<T>,
    stage: { pos: Point; flush: () => Promise<void> },
    trace: Point[] = []
): Promise<T> {
    let settled = false;
    promise.then(() => (settled = true), () => (settled = true));

    for (let frame = 0; frame < FRAME_LIMIT && !settled; frame++) {
        trace.push({ ...stage.pos });
        await stage.flush();
    }

    if (!settled) {
        throw new Error(`сценарий не доиграл за ${FRAME_LIMIT} кадров`);
    }

    return promise;
}


describe('act', () => {
    it('put merges the patch without waiting', () => {
        const { act, getState } = env();
        act.put({ value: 'a' });
        expect(getState().value).toBe('a');
    });

    it('type writes every prefix and ends with the whole text', async () => {
        const { act, getState } = env();
        await act.type('value', '14:30', { interval: 1 });
        expect(getState().value).toBe('14:30');
    });

    it('moves the cursor to the target centre and takes its kind', async () => {
        const { act, pos, kinds } = env();
        await act.move('field');
        expect(pos).toEqual({ x: 200, y: 70 });
        expect(kinds.at(-1)).toBe('ibeam');
    });

    // Середина твина: курсор проходит путь по кадрам, а не прыгает в конец и не уезжает за цель.
    it('walks the cursor along the path, never past the target', async () => {
        const { act, pos, flush } = env('queued');
        const trace: Point[] = [];
        await drive(act.move('field'), { pos, flush }, trace);

        const waypoints = trace.filter((p) => p.x > 0 && p.x < 200 && p.y > 0 && p.y < 70);
        expect(waypoints.length).toBeGreaterThan(2);
        // Расстояние до цели только сокращается: начало пути не «уезжает» вместе с курсором.
        const gaps = trace.map((p) => Math.hypot(200 - p.x, 70 - p.y));
        gaps.slice(1).forEach((gap, index) => expect(gap).toBeLessThanOrEqual(gaps[index]));
        expect(pos).toEqual({ x: 200, y: 70 });
    });

    it('marks hover and press with Koobiq state classes while pressed', async () => {
        const { act, field, cursor } = env();
        await act.click('field');
        expect(field.classList.contains('kbq-hover')).toBe(true);
        expect(field.hasAttribute('data-hover')).toBe(true);
        expect(field.classList.contains('kbq-active')).toBe(false);
        expect(field.hasAttribute('data-pressed')).toBe(false);
        expect(cursor.hasAttribute('data-pressed')).toBe(false);
    });

    // Нажатие видно именно во время удержания: если `press` не сработает, тест упадёт.
    it('keeps the press on the target while the click is held', async () => {
        const { act, cursor, field, flush } = env('queued');
        const click = act.click('field');
        let settled = false;
        let held = 0;
        click.then(() => (settled = true), () => (settled = true));

        for (let frame = 0; frame < FRAME_LIMIT && !settled; frame++) {
            await flush();

            if (field.classList.contains('kbq-active')) {
                held++;
                expect(field.hasAttribute('data-pressed')).toBe(true);
                expect(cursor.hasAttribute('data-pressed')).toBe(true);
            }
        }

        expect(settled).toBe(true);
        await click;
        expect(held).toBeGreaterThan(1);
        expect(field.classList.contains('kbq-active')).toBe(false);
        expect(field.hasAttribute('data-pressed')).toBe(false);
        expect(cursor.hasAttribute('data-pressed')).toBe(false);
    });

    it('shows keycaps while the key is held', async () => {
        const { act, keys } = env();
        await act.key('cmd+c');
        expect(keys.length).toBeGreaterThan(0);
    });

    it('snap applies the patch and switches transitions off for two frames', async () => {
        const { act, getState } = env();
        await act.snap({ value: '14:30' });
        expect(getState().value).toBe('14:30');
    });

    // Переходы снимаются ровно на время подмены состояния, а не навсегда.
    it('keeps the instant flag only while the snap lasts', async () => {
        const { act, controller, root } = env('manual');
        const snap = act.snap({ value: '14:30' });
        expect(root.hasAttribute('data-instant')).toBe(true);
        controller.abort();
        await expect(snap).rejects.toBeInstanceOf(Stopped);
        expect(root.hasAttribute('data-instant')).toBe(false);
    });

    it('enter brings the cursor to the target from the parked point', async () => {
        const { act, pos } = env();
        await act.enter('field');
        expect(pos).toEqual({ x: 200, y: 70 });
    });

    // Вход не выводит курсор за кадр: первая точка пути — точка покоя внутри сцены.
    it('walks to the target without leaving the frame', async () => {
        const { act, pos, flush } = env('queued');
        const trace: Point[] = [];

        await drive(act.enter('field'), { pos, flush }, trace);

        for (const point of trace) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(720);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeLessThanOrEqual(400);
        }

        expect(trace.length).toBeGreaterThan(2);
        expect(pos).toEqual({ x: 200, y: 70 });
    });

    // Клик без цели нажимает там, куда курсор пришёл входом: нажатие не теряется.
    it('presses the target the entry stopped at', async () => {
        const { act, field } = env();

        await act.enter('field');
        await act.click();

        expect(field.hasAttribute('data-hover')).toBe(true);
    });

    it('rect measures a target in stage pixels', async () => {
        const { act } = env();
        expect(act.rect('field')).toEqual({ x: 100, y: 50, width: 200, height: 40 });
    });

    it('rejects a wait with Stopped when aborted and releases the press', async () => {
        const { act, controller, field } = env();
        const click = act.click('field');
        controller.abort();
        await expect(click).rejects.toBeInstanceOf(Stopped);
        expect(field.classList.contains('kbq-active')).toBe(false);
        expect(field.hasAttribute('data-pressed')).toBe(false);
    });

    // Ожидание, которое правда висит: abort и снимает работу, и отклоняет ожидание.
    it('drops a pending wait and its frame on abort', async () => {
        const { act, controller, cancelled } = env('manual');
        const wait = act.wait(300);
        controller.abort();
        await expect(wait).rejects.toBeInstanceOf(Stopped);
        expect(cancelled.length).toBeGreaterThan(0);
    });

    it('ignores an unknown target', async () => {
        const { act, pos } = env();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await act.move('nope');
        expect(pos).toEqual({ x: 0, y: 0 });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
