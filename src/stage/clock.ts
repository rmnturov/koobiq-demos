/**
 * Часы сцены: единственный источник времени и отложенной работы.
 *
 * Сцена и скрипты не вызывают setTimeout/requestAnimationFrame напрямую — только через Clock.
 * Благодаря этому пауза плеера замораживает всё: и таймауты, и кадры, — а тесты идут
 * на подставном хосте без реального времени.
 */

import { InjectionToken } from '@angular/core';

/** Носитель времени: то, что реально умеет ждать. Подменяется в тестах. */
export interface ClockHost {
    now(): number;
    setTimeout(cb: () => void, ms: number): number;
    clearTimeout(id: number): void;
    requestAnimationFrame(cb: () => void): number;
    cancelAnimationFrame(id: number): void;
}

export interface Clock {
    /** Логическое время: стоит на месте, пока часы на паузе. */
    now(): number;
    raf(cb: () => void): number;
    cancelRaf(id: number): void;
    timeout(cb: () => void, ms: number): number;
    clearTimeout(id: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
}

type TimerKind = 'timeout' | 'frame';

interface PendingTimer {
    cb: () => void;
    kind: TimerKind;
    /** Логическое время срабатывания таймаута; у кадра — момент запроса. */
    due: number;
    /** Остаток до срабатывания: на паузе хранится именно он, а не дедлайн. */
    remaining: number;
    /** Идентификатор на хосте; null, пока часы на паузе. */
    hostId: number | null;
}

const FRAME_FALLBACK_MS = 16;

/** Идентификатор «ничего не запланировано»: clearTimeout(0) безопасен. */
const NO_TIMER = 0;

export function defaultClockHost(): ClockHost {
    const hasFrames = typeof globalThis.requestAnimationFrame === 'function';

    return {
        now: () => Date.now(),
        setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number,
        clearTimeout: (id) => globalThis.clearTimeout(id),
        requestAnimationFrame: (cb) =>
            hasFrames
                ? globalThis.requestAnimationFrame(cb)
                : (globalThis.setTimeout(cb, FRAME_FALLBACK_MS) as unknown as number),
        cancelAnimationFrame: (id) =>
            hasFrames ? globalThis.cancelAnimationFrame(id) : globalThis.clearTimeout(id)
    };
}

/**
 * Точка подмены времени: по умолчанию — настоящие таймеры, в тестах — ручной хост.
 * Компонент берёт носитель отсюда, поэтому его часы не спрятаны внутри.
 */
export const CLOCK_HOST = new InjectionToken<ClockHost>('CLOCK_HOST', {
    factory: () => defaultClockHost()
});

export function createClock(host: ClockHost = defaultClockHost()): Clock {
    const pending = new Map<number, PendingTimer>();
    let seq = 0;
    let paused = false;
    let disposed = false;
    /** Момент паузы в хостовом времени; осмыслен только на паузе. */
    let pausedAt = 0;
    /** Сколько хостового времени «съели» паузы. */
    let offset = 0;

    const logicalNow = (): number => (paused ? pausedAt : host.now()) - offset;

    const cancel = (timer: PendingTimer): void => {
        if (timer.hostId === null) {
            return;
        }

        if (timer.kind === 'timeout') {
            host.clearTimeout(timer.hostId);
        } else {
            host.cancelAnimationFrame(timer.hostId);
        }

        timer.hostId = null;
    };

    const fire = (id: number): void => {
        const timer = pending.get(id);

        if (!timer || paused || disposed) {
            return;
        }

        pending.delete(id);
        timer.hostId = null;
        timer.cb();
    };

    const arm = (id: number, timer: PendingTimer): void => {
        timer.hostId =
            timer.kind === 'timeout'
                ? host.setTimeout(() => fire(id), timer.remaining)
                : host.requestAnimationFrame(() => fire(id));
    };

    const schedule = (cb: () => void, kind: TimerKind, ms: number): number => {
        if (disposed) {
            return NO_TIMER;
        }

        const id = ++seq;
        const delay = Math.max(0, ms);
        const timer: PendingTimer = {
            cb,
            kind,
            due: logicalNow() + delay,
            remaining: delay,
            hostId: null
        };

        pending.set(id, timer);

        if (!paused) {
            arm(id, timer);
        }

        return id;
    };

    const cancelById = (id: number): void => {
        const timer = pending.get(id);

        if (!timer) {
            return;
        }

        cancel(timer);
        pending.delete(id);
    };

    return {
        now: logicalNow,

        raf: (cb) => schedule(cb, 'frame', 0),

        cancelRaf: cancelById,

        timeout: (cb, ms) => schedule(cb, 'timeout', ms),

        clearTimeout: cancelById,

        pause(): void {
            if (paused || disposed) {
                return;
            }

            paused = true;
            pausedAt = host.now();

            for (const timer of pending.values()) {
                // Дедлайн не переживает паузу: снимаем таймер и запоминаем остаток.
                timer.remaining = Math.max(0, timer.due - logicalNow());
                cancel(timer);
            }
        },

        resume(): void {
            if (!paused || disposed) {
                return;
            }

            paused = false;
            offset += host.now() - pausedAt;

            for (const [id, timer] of pending) {
                timer.due = logicalNow() + timer.remaining;
                arm(id, timer);
            }
        },

        dispose(): void {
            if (disposed) {
                return;
            }

            for (const timer of pending.values()) {
                cancel(timer);
            }

            pending.clear();
            disposed = true;
            paused = false;
        }
    };
}
