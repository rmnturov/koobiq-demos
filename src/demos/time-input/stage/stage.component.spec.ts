import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SCENARIOS } from '../scenarios/scenarios';
import { SceneComponent } from '../scenes/scene.component';
import { SceneState } from '../scenes/scene-state';
import { Script, Stopped } from '../../../stage/act';
import { CLOCK_HOST, ClockHost } from '../../../stage/clock';
import { Rect } from '../../../stage/measure';
import { StageComponent } from './stage.component';

const initial: SceneState = { field: { value: '', error: null, hint: null }, focused: false, selection: null, toast: null, caption: '' };
const poster: SceneState = { ...initial, field: { value: '14:16', error: null, hint: null } };

@Component({
    imports: [StageComponent],
    template: `
        <time-input-stage
            [width]="720"
            [height]="480"
            [initial]="initial"
            [poster]="poster"
            [script]="script"
            [cursorAt]="{ at: 'field', x: 0.9, y: 0.5 }"
            [play]="play"
        >
            <ng-template let-s>
                <div data-target="field"><input [value]="s.field.value" /></div>
            </ng-template>
        </time-input-stage>
    `
})
class Host {
    initial = initial;
    poster = poster;
    script: Script<SceneState> = async () => {};
    play: 'loop' | 'once' = 'once';
}

/**
 * Хост на границе «плеер → сцена»: проверяется ровно тот путь, которым пауза
 * попадает в сцену, — ключ `paused` в контексте аутлета и вход `[paused]` сцены.
 * Если шаблон потеряет `let-p="paused"`, вход молча станет `undefined`, пауза
 * останется только в плеере, а каретка продолжит мигать.
 */
@Component({
    imports: [StageComponent, SceneComponent],
    template: `
        <time-input-stage [initial]="initial" [poster]="poster" [play]="'once'">
            <ng-template let-s let-p="paused">
                <time-input-scene [state]="s" [scenario]="scenario" [paused]="p" />
            </ng-template>
        </time-input-stage>
    `
})
class SceneHost {
    initial = initial;
    poster = poster;
    scenario = SCENARIOS.find((item) => item.id === 'type-auto') ?? SCENARIOS[0];
}

/** Ручные часы теста: время идёт только по `tick`, работа — только по запросу. */
interface TestHost extends ClockHost {
    /** Проматывает время вперёд, отдавая микрозадачи между срабатываниями. */
    tick(ms: number): Promise<void>;
    /** Сколько таймеров и кадров ещё висит на хосте. */
    readonly pending: number;
    /** Сколько срабатываний было за тест: по нему видно, что после destroy тишина. */
    readonly fired: number;
}

/**
 * Кадр и таймаут — это отложенный вызов, а продолжение `await` — микрозадача.
 * Промотка отдаёт очередь после каждого срабатывания, иначе следующий таймер
 * петли не будет поставлен и время «уедет» вперёд без работы.
 */
const flush = async (): Promise<void> => {
    for (let i = 0; i < 8; i++) {
        await Promise.resolve();
    }
};

const testHost = (): TestHost => {
    let time = 0;
    let seq = 0;
    let fired = 0;
    const timers = new Map<number, { cb: () => void; due: number }>();

    return {
        now: () => time,
        setTimeout: (cb, ms) => {
            const id = ++seq;

            timers.set(id, { cb, due: time + ms });

            return id;
        },
        clearTimeout: (id) => void timers.delete(id),
        requestAnimationFrame: (cb) => {
            const id = ++seq;

            timers.set(id, { cb, due: time + 16 });

            return id;
        },
        cancelAnimationFrame: (id) => void timers.delete(id),
        get pending() {
            return timers.size;
        },
        get fired() {
            return fired;
        },
        tick: async (ms) => {
            const target = time + ms;

            await flush();

            for (;;) {
                let nextId: number | null = null;
                let nextDue = Number.POSITIVE_INFINITY;

                for (const [id, timer] of timers) {
                    if (timer.due <= target && timer.due < nextDue) {
                        nextId = id;
                        nextDue = timer.due;
                    }
                }

                if (nextId === null) {
                    break;
                }

                const timer = timers.get(nextId)!;

                timers.delete(nextId);
                time = Math.max(time, timer.due);
                fired++;
                timer.cb();

                await flush();
            }

            time = target;

            await flush();
        }
    };
};

/** Созданные фикстуры: уничтожаем их сами, чтобы `ngOnDestroy` исполнялся в каждом тесте. */
const fixtures = new Set<ComponentFixture<unknown>>();

function destroy(fixture: ComponentFixture<unknown>): void {
    if (fixtures.delete(fixture)) {
        fixture.destroy();
    }
}

/**
 * jsdom не знает `ResizeObserver`: заглушка запоминает подписку и отдаёт замер
 * тесту. Так раскладку задаёт тест, а проверяется настоящий путь `measure`.
 */
class TestResizeObserver {
    static readonly created: TestResizeObserver[] = [];

    private readonly targets = new Set<Element>();

    constructor(private readonly callback: ResizeObserverCallback) {
        TestResizeObserver.created.push(this);
    }

    observe(target: Element): void {
        this.targets.add(target);
    }

    unobserve(target: Element): void {
        this.targets.delete(target);
    }

    disconnect(): void {
        this.targets.clear();
    }

    /** Отдаёт замер так, как это сделал бы браузер после раскладки. */
    fire(): void {
        const entries = [...this.targets].map((target) => ({ target }) as ResizeObserverEntry);

        this.callback(entries, this as unknown as ResizeObserver);
    }
}

/** Ставит заглушку `ResizeObserver`; подписку тест берёт у `TestResizeObserver.created`. */
function stubResizeObserver(): void {
    TestResizeObserver.created.length = 0;
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
}

/** Последняя подписка сцены: её и дергает тест после подмены ширины места. */
function resizeOf(): TestResizeObserver {
    const observer = TestResizeObserver.created[TestResizeObserver.created.length - 1];

    if (!observer) {
        throw new Error('stage did not observe the fit');
    }

    return observer;
}

/** Подменяет прямоугольник: в jsdom раскладки нет, ширину места задаёт тест. */
function place(element: HTMLElement, width: number, height = 0): void {
    element.getBoundingClientRect = () =>
        ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect;
}

async function render(options: {
    script?: Script<SceneState>;
    motion?: 'no-preference' | 'reduce';
    play?: 'loop' | 'once';
    host?: TestHost;
} = {}) {
    const { script = async () => {}, motion = 'no-preference', play = 'once', host = testHost() } = options;

    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: motion === 'reduce' && query.includes('prefers-reduced-motion'),
        addEventListener: () => {},
        removeEventListener: () => {}
    }) as unknown as MediaQueryList);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
        imports: [Host],
        providers: [{ provide: CLOCK_HOST, useValue: host }]
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);

    fixtures.add(fixture);
    fixture.componentInstance.script = script;
    fixture.componentInstance.play = play;
    fixture.detectChanges();
    await fixture.whenStable();

    const stage = fixture.debugElement.query(By.directive(StageComponent)).componentInstance as StageComponent;

    return { fixture, stage, host };
}

describe('StageComponent', () => {
    afterEach(() => {
        for (const fixture of [...fixtures]) {
            destroy(fixture);
        }

        TestResizeObserver.created.length = 0;
        TestBed.resetTestingModule();
        vi.unstubAllGlobals();
    });

    it('shows the poster instead of running under reduced motion', async () => {
        let runs = 0;
        const { fixture } = await render({
            motion: 'reduce',
            script: async () => {
                runs++;
            }
        });

        expect(runs).toBe(0);
        expect(fixture.nativeElement.querySelector('input')?.value).toBe('14:16');
    });

    it('keeps the frame deaf to the real pointer', async () => {
        const { fixture } = await render();
        const stage = fixture.nativeElement.querySelector('.stage') as HTMLElement;
        const style = getComputedStyle(stage);

        // Сцена декоративная: настоящая мышь не наводится на её контролы и не
        // выделяет текст — всё, что видно, разыгрывает проигрыватель.
        expect(style.pointerEvents).toBe('none');
        expect(style.userSelect).toBe('none');
    });

    it('counts a run, replays it and keeps a single cursor', async () => {
        const { fixture, stage } = await render();

        expect(stage.runCount()).toBe(1);

        stage.replay();
        await fixture.whenStable();

        expect(stage.runCount()).toBe(2);
        expect(fixture.nativeElement.querySelectorAll('time-input-cursor').length).toBe(1);
    });

    it('keeps the poster on screen and the player idle under reduced motion', async () => {
        const { fixture, stage } = await render({ motion: 'reduce' });

        expect(stage.runCount()).toBe(0);
        expect(fixture.nativeElement.querySelectorAll('time-input-cursor').length).toBe(1);
    });

    it('runs the next pass of the loop after the gap resets the scene', async () => {
        const passes: string[] = [];
        const { stage, host } = await render({
            play: 'loop',
            script: async (act) => {
                passes.push(`pass${passes.length + 1}`);
                act.put({ field: { value: `pass${passes.length}`, error: null, hint: null } });
            }
        });

        expect(stage.runCount()).toBe(1);
        expect(stage.state().field.value).toBe('pass1');
        // Проход кончился на микрозадаче, и разрыв уже начался: сцена гаснет.
        expect(stage.resetting()).toBe(true);

        // Первая половина разрыва: сцена возвращается к началу.
        await host.tick(180);

        expect(stage.resetting()).toBe(true);
        expect(stage.state().field.value).toBe('');

        // Вторая половина: сцена проявляется.
        await host.tick(180);

        expect(stage.resetting()).toBe(false);
        expect(stage.runCount()).toBe(1);

        // Пауза «устояться» — и петля начинает второй проход.
        await host.tick(300);

        expect(stage.runCount()).toBe(2);
        expect(stage.state().field.value).toBe('pass2');
        expect(passes).toEqual(['pass1', 'pass2']);
    });

    it('does not advance the run while paused and continues it on resume', async () => {
        let runs = 0;
        const { stage, host } = await render({
            play: 'loop',
            script: async (act) => {
                runs++;
                await act.wait(100);
            }
        });

        expect(stage.runCount()).toBe(1);
        expect(runs).toBe(1);

        stage.pause();
        expect(stage.paused()).toBe(true);

        const fired = host.fired;

        await host.tick(5000);

        expect(stage.runCount()).toBe(1);
        expect(runs).toBe(1);
        expect(stage.resetting()).toBe(false);
        expect(host.fired).toBe(fired);

        stage.resume();
        await host.tick(120);
        await host.tick(660);

        expect(stage.runCount()).toBe(2);
        expect(runs).toBe(2);
    });

    // Пауза доходит до сцены через контекст аутлета: класс на хосте сцены — то,
    // по чему CSS снимает мигание каретки. Проверяется в обе стороны: пауза и снятие.
    it('delivers the pause to the projected scene through the outlet context', async () => {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query.includes('prefers-reduced-motion'),
            addEventListener: () => {},
            removeEventListener: () => {},
            // Старый API: его дергает CDK MediaMatcher из полей сцены.
            addListener: () => {},
            removeListener: () => {}
        }) as unknown as MediaQueryList);
        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
            imports: [SceneHost],
            providers: [{ provide: CLOCK_HOST, useValue: testHost() }]
        }).compileComponents();
        const fixture = TestBed.createComponent(SceneHost);

        fixtures.add(fixture);
        fixture.detectChanges();
        await fixture.whenStable();

        const stage = fixture.debugElement.query(By.directive(StageComponent)).componentInstance as StageComponent;
        const scene = (): HTMLElement => fixture.nativeElement.querySelector('time-input-scene') as HTMLElement;
        const paused = (): boolean => scene().classList.contains('scene_paused');

        expect(paused()).toBe(false);

        stage.pause();
        fixture.detectChanges();

        expect(stage.paused()).toBe(true);
        expect(paused()).toBe(true);

        stage.resume();
        fixture.detectChanges();

        expect(paused()).toBe(false);
    });

    it('stops the run and leaves no timers after destroy', async () => {
        let runs = 0;
        let stopped = false;
        const { fixture, stage, host } = await render({
            play: 'loop',
            script: async (act) => {
                runs++;

                try {
                    await act.wait(100);
                } catch (error) {
                    // Abort на destroy должен дойти до ожидания сценария.
                    stopped = error instanceof Stopped;

                    throw error;
                }
            }
        });

        await host.tick(50);

        expect(stage.runCount()).toBe(1);
        expect(host.pending).toBeGreaterThan(0);

        const fired = host.fired;

        destroy(fixture);

        expect(host.pending).toBe(0);

        await host.tick(5000);

        expect(stopped).toBe(true);
        expect(host.fired).toBe(fired);
        expect(stage.runCount()).toBe(1);
        expect(runs).toBe(1);
    });

    it('folds the frame below 600px of place and keeps the run going', async () => {
        stubResizeObserver();
        const { fixture, stage, host } = await render({
            play: 'loop',
            script: async (act) => {
                act.put({ field: { value: 'в процессе', error: null, hint: null } });
                await act.wait(100);
            }
        });
        const fit = fixture.nativeElement.querySelector('.stage-fit') as HTMLElement;
        const frame = (): HTMLElement => fixture.nativeElement.querySelector('.stage') as HTMLElement;

        // Широкий кадр: место меньше 720, но больше порога.
        place(fit, 900);
        resizeOf().fire();
        fixture.detectChanges();

        expect(frame().getAttribute('data-frame')).toBe('wide');
        expect(frame().style.width).toBe('720px');
        expect(stage.scale()).toBe(1);

        const runs = stage.runCount();

        // Место сузилось: кадр складывается в 360×500, текст остаётся своего размера.
        place(fit, 560);
        resizeOf().fire();
        fixture.detectChanges();

        expect(frame().getAttribute('data-frame')).toBe('narrow');
        expect(frame().style.width).toBe('360px');
        expect(frame().style.height).toBe('500px');
        expect(fit.style.height).toBe('500px');
        expect(stage.scale()).toBe(1);

        // Смена кадра — это раскладка: проход не начинается заново и не рвётся.
        expect(stage.runCount()).toBe(runs);
        expect(stage.state().field.value).toBe('в процессе');

        // Место снова широкое: кадр возвращается, проход всё тот же.
        place(fit, 900);
        resizeOf().fire();
        fixture.detectChanges();

        expect(frame().getAttribute('data-frame')).toBe('wide');
        expect(frame().style.width).toBe('720px');
        expect(stage.runCount()).toBe(runs);

        // Петля жива: после ожидания сценарий доходит до конца прохода и разрыва.
        await host.tick(800);

        expect(stage.runCount()).toBe(runs + 1);
    });

    it('gives the frame the whole place when it is narrower than 360px', async () => {
        stubResizeObserver();
        const { fixture, stage } = await render();
        const fit = fixture.nativeElement.querySelector('.stage-fit') as HTMLElement;
        const frame = (): HTMLElement => fixture.nativeElement.querySelector('.stage') as HTMLElement;

        place(fit, 296);
        resizeOf().fire();
        fixture.detectChanges();

        // 320px экран: 360-й кадр дал бы масштаб 0.82 и 11px текста.
        expect(frame().style.width).toBe('296px');
        expect(frame().style.height).toBe('500px');
        expect(stage.scale()).toBe(1);
    });

    // Курсор — часть показа: пока сценарий идёт, он стоит там, куда его поставили.
    it('keeps the cursor visible through the long waits of the scenario', async () => {
        const { fixture, host } = await render({
            script: async (act) => {
                await act.move('field');
                await act.wait(5000);
            }
        });
        const cursor = (): HTMLElement => fixture.nativeElement.querySelector('.stage__cursor') as HTMLElement;
        const field = fixture.nativeElement.querySelector('[data-target="field"]') as HTMLElement;

        place(field, 200, 40);

        await host.tick(1200);
        const atField = cursor().style.transform;

        // Три секунды молчания: курсор не гаснет и не уезжает с места, куда навели.
        await host.tick(3000);

        expect(cursor().style.transform).toBe(atField);
        expect(cursor().hasAttribute('data-idle')).toBe(false);
    });

    it('keeps cursor targets resolvable after the frame folds', async () => {
        stubResizeObserver();
        let measured: Rect | null = null;
        const { fixture, stage, host } = await render({
            script: async (act) => {
                await act.wait(10);
                measured = act.rect('field');
            }
        });
        const fit = fixture.nativeElement.querySelector('.stage-fit') as HTMLElement;
        const field = fixture.nativeElement.querySelector('[data-target="field"]') as HTMLElement;

        place(fit, 296);
        resizeOf().fire();
        fixture.detectChanges();

        // Цель в пикселях сцены: при масштабе 1 она снимается без деления.
        field.getBoundingClientRect = () =>
            ({ x: 10, y: 20, left: 10, top: 20, right: 210, bottom: 60, width: 200, height: 40, toJSON: () => ({}) }) as DOMRect;

        await host.tick(20);

        expect(measured).toEqual({ x: 10, y: 20, width: 200, height: 40 });
        expect(stage.scale()).toBe(1);
    });
});
