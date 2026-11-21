import { ClockHost, createClock } from './clock';

type TestHost = ClockHost & { tick: (ms: number) => void };

const host = (): TestHost => {
    let time = 0;
    let seq = 0;
    const timers = new Map<number, { cb: () => void; due: number }>();
    return {
        now: () => time,
        setTimeout: (cb, ms) => {
            const id = ++seq;
            timers.set(id, { cb, due: time + ms });
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
        requestAnimationFrame: (cb) => {
            const id = ++seq;
            timers.set(id, { cb, due: time + 16 });
            return id;
        },
        cancelAnimationFrame: (id) => timers.delete(id),
        tick: (ms) => {
            time += ms;
            for (const [id, timer] of [...timers]) {
                if (timer.due <= time) {
                    timers.delete(id);
                    timer.cb();
                }
            }
        }
    };
};

describe('clock', () => {
    it('fires a timeout after its delay', () => {
        const h = host();
        const clock = createClock(h);
        const fired: string[] = [];
        clock.timeout(() => fired.push('done'), 500);
        h.tick(499);
        expect(fired).toEqual([]);
        h.tick(1);
        expect(fired).toEqual(['done']);
    });

    it('holds pending work while paused and finishes it after resume', () => {
        const h = host();
        const clock = createClock(h);
        const fired: string[] = [];
        clock.timeout(() => fired.push('done'), 500);
        h.tick(200);
        clock.pause();
        h.tick(5000);
        expect(fired).toEqual([]);
        clock.resume();
        h.tick(299);
        expect(fired).toEqual([]);
        h.tick(1);
        expect(fired).toEqual(['done']);
    });

    it('runs a frame requested while paused only after resume', () => {
        const h = host();
        const clock = createClock(h);
        const frames: number[] = [];
        clock.pause();
        clock.raf(() => frames.push(1));
        h.tick(100);
        expect(frames).toEqual([]);
        clock.resume();
        h.tick(16);
        expect(frames).toEqual([1]);
    });

    it('freezes logical time on pause and continues it after resume', () => {
        const h = host();
        const clock = createClock(h);
        h.tick(100);
        expect(clock.now()).toBe(100);
        clock.pause();
        h.tick(5000);
        expect(clock.now()).toBe(100);
        clock.resume();
        expect(clock.now()).toBe(100);
        h.tick(50);
        expect(clock.now()).toBe(150);
    });

    it('cancels pending work by id without firing it', () => {
        const h = host();
        const clock = createClock(h);
        const fired: string[] = [];
        clock.clearTimeout(clock.timeout(() => fired.push('timeout'), 100));
        clock.cancelRaf(clock.raf(() => fired.push('frame')));
        h.tick(1000);
        expect(fired).toEqual([]);
    });

    it('drops pending work on dispose', () => {
        const h = host();
        const clock = createClock(h);
        const fired: string[] = [];
        clock.timeout(() => fired.push('timeout'), 100);
        clock.raf(() => fired.push('frame'));
        clock.dispose();
        h.tick(1000);
        expect(fired).toEqual([]);
    });
});
