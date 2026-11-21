/**
 * Проигрыватель сцены: кадр фиксированного размера, масштаб под ширину, курсор,
 * кепки и запуск сценария.
 *
 * Кадр — это дизайнерские пиксели (`width`×`height`). В окно он вписывается
 * целиком: `scale = min(1, ширина места / width)`, а `.stage-fit` держит высоту
 * `height * scale`. Поэтому замеры сцены всегда в её собственных пикселях, а
 * `Act` получает `scale` и делит на него всё, что снято с окна.
 *
 * Ниже 600px места кадр складывается в узкий 360×500 (`frameFor`): в широком
 * кадре текст сцены ужимался бы до 6px. Смена кадра — это только раскладка: входы
 * `width`/`height` остаются дизайнерскими, сценарий не перезапускается, а цели
 * скрипта адресуются по именам и от кадра не зависят.
 *
 * Время и отложенная работа — только через `Clock`: пауза замораживает и
 * ожидания сценария, и гашение между проходами петли. `ngOnDestroy` отменяет
 * запуск, снимает наблюдателей и уничтожает часы, поэтому сценарий не может
 * продолжиться после уничтожения сцены.
 *
 * Сцена декоративная: `aria-hidden="true"`, фокус не переносится, курсор и кепки
 * не ловят события. Под reduced-motion мультик не запускается — виден постер.
 */

import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    contentChild,
    effect,
    ElementRef,
    input,
    inject,
    OnDestroy,
    signal,
    TemplateRef,
    untracked,
    viewChild,
    ViewEncapsulation
} from '@angular/core';
import { SceneState, initialState } from '../scenes/scene-state';
import { Act, createAct, KeyState, Patch, Script, Stopped } from '../../../stage/act';
import { CLOCK_HOST, createClock } from '../../../stage/clock';
import { CursorComponent } from '../../../stage/cursor.component';
import { Frame, frameFor } from '../../../stage/frame';
import { KeycapsComponent } from '../../../stage/keycaps.component';
import { CursorKind, Point, Target } from '../../../stage/measure';

/** Разрыв между проходами петли: гашение, подмена состояния, возврат курсора. */
const FADE_MS = 180;
/** Пауза после возврата курсора: сцена должна «устояться» до нового прохода. */
const SETTLE_MS = 300;
/** Жизнь волны клика: столько же, сколько идёт её CSS-анимация. */
const RIPPLE_MS = 480;

/** Начальная точка курсора: за кадром, пока `Act` не поставил его к цели. */
const OFFSCREEN: Point = { x: 0, y: -100 };

/** Сценарий по умолчанию: сцена без сценария просто стоит. */
const noop: Script<SceneState> = async () => {};

/** Волна клика: точка в пикселях сцены. */
interface Ripple {
    readonly id: number;
    readonly x: number;
    readonly y: number;
}

/**
 * Движение разрешено, если система его не запрещает. Без `matchMedia` (старый
 * браузер, тестовая среда) считаем, что разрешено: демо должно играть.
 */
const motionAllowed = (): boolean =>
    typeof matchMedia !== 'function' || !matchMedia('(prefers-reduced-motion: reduce)').matches;

@Component({
    selector: 'time-input-stage',
    imports: [NgTemplateOutlet, CursorComponent, KeycapsComponent],
    template: `
        <div class="stage-fit" #fit [style.height.px]="frame().height * scale()">
            <div
                class="stage"
                #stage
                aria-hidden="true"
                [attr.data-resetting]="resetting() ? '' : null"
                [attr.data-frame]="frame().narrow ? 'narrow' : 'wide'"
                [style.width.px]="frame().width"
                [style.height.px]="frame().height"
                [style.transform]="'scale(' + scale() + ')'"
            >
                <ng-container
                    [ngTemplateOutlet]="scene()"
                    [ngTemplateOutletContext]="{ $implicit: state(), paused: paused() }"
                />

                @for (ripple of ripples(); track ripple.id) {
                    <span class="stage__ripple" [style.left.px]="ripple.x" [style.top.px]="ripple.y"></span>
                }

                <time-input-cursor #cursor [kind]="kind()" />
                <time-input-keycaps [keys]="keys()" />
            </div>
        </div>
    `,
    styleUrl: './stage.component.scss',
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StageComponent implements OnDestroy {
    /** Ширина кадра в дизайнерских пикселях. */
    readonly width = input(720);
    /** Высота кадра в дизайнерских пикселях. */
    readonly height = input(400);
    /** Растянуть кадр на всё место по ширине: серая полоса идёт до края колонки. */
    readonly fill = input(false);
    /** Состояние, с которого начинается проход. */
    readonly initial = input.required<SceneState>();
    /** Финальный кадр для reduced-motion; без него показывается `initial`. */
    readonly poster = input<SceneState | null>(null);
    /** Сценарий прохода. */
    readonly script = input<Script<SceneState>>(noop);
    /** Где курсор стоит до первого движения и между проходами. */
    readonly cursorAt = input<Target>('field');
    /** `once` — один проход, `loop` — петля с гашением между проходами. */
    readonly play = input<'loop' | 'once'>('loop');

    /** То, что видит сцена: единственный источник правды для шаблона. */
    readonly state = signal<SceneState>(initialState());
    /** Пауза по просьбе плеера; вне вьюпорта сцена замирает отдельно. */
    readonly paused = signal(false);
    /** Сколько проходов начато: по нему видно, что петля жива. */
    readonly runCount = signal(0);
    /** Идёт разрыв между проходами: сцена погашена. */
    readonly resetting = signal(false);
    /** Вид курсора: им владеет `Act`, шаблон только показывает. */
    readonly kind = signal<CursorKind>('default');
    /** Кепки: ими владеет `Act`. */
    readonly keys = signal<KeyState | null>(null);
    /** Ширина места под кадр в обычных пикселях: её меряет `ResizeObserver`. */
    private readonly available = signal(0);
    /** Кадр под место: широкий входной или узкий 360×460 ниже 600px. */
    protected readonly frame = computed<Frame>(() =>
        frameFor(this.available(), { width: this.width(), height: this.height() }, this.fill())
    );
    /** Масштаб кадра: 1, пока места хватает. Узкий кадр в место уже влез. */
    readonly scale = computed(() => {
        const width = this.frame().width;
        const available = this.available();

        // Нулевая ширина — ещё не раскладка: до первого замера кадр как есть.
        if (!(available > 0) || !(width > 0)) {
            return 1;
        }

        return Math.min(1, available / width);
    });
    /** Волны кликов: их рисует сцена, а не `Act`. */
    readonly ripples = signal<readonly Ripple[]>([]);

    /** Содержимое сцены: `let-s` — состояние прохода, `paused` — пауза плеера. */
    protected readonly scene = contentChild.required<TemplateRef<{ $implicit: SceneState; paused: boolean }>>(
        TemplateRef
    );
    private readonly fit = viewChild<ElementRef<HTMLElement>>('fit');
    private readonly stageEl = viewChild<ElementRef<HTMLElement>>('stage');
    private readonly cursorEl = viewChild('cursor', { read: ElementRef });

    /** Часы сцены: носитель приходит из `CLOCK_HOST`, в тестах он ручной. */
    private readonly clock = createClock(inject(CLOCK_HOST));
    /** Позиция курсора в пикселях сцены: `Act` мутирует её на месте. */
    private readonly pos: Point = { ...OFFSCREEN };
    /** Вне вьюпорта или вкладка скрыта: часы стоят, но пауза не «пользовательская». */
    private readonly away = signal(false);

    private controller: AbortController | null = null;
    /** Состояние, к которому возвращается каждый проход петли. */
    private base: SceneState | null = null;
    private script$: Script<SceneState> = noop;
    /** Вид собран: только теперь можно брать элементы сцены и запускать сценарий. */
    private ready = false;
    /** Запуск попросили до того, как вид собрался. */
    private queued = false;

    private resizeObserver: ResizeObserver | null = null;
    private intersectionObserver: IntersectionObserver | null = null;

    private rippleSeq = 0;
    private readonly rippleTimers = new Set<number>();

    constructor() {
        // Входы — единственное, что перезапускает сцену. Всё остальное в
        // `begin` — императивная работа с DOM и часами, в граф эффекта не идёт.
        effect(() => {
            const script = this.script();
            const initial = this.initial();
            const poster = this.poster();

            untracked(() => this.begin(script, initial, poster));
        });

        // Ширина кадра меняется без изменения места: пересчитываем масштаб сами.
        effect(() => {
            this.width();

            untracked(() => this.measure());
        });
    }

    ngAfterViewInit(): void {
        this.ready = true;
        this.observeFit();
        this.observeVisibility();
        this.measure();

        if (this.queued) {
            this.queued = false;
            this.launch();
        }
    }

    ngOnDestroy(): void {
        this.stop();
        this.resizeObserver?.disconnect();
        this.intersectionObserver?.disconnect();
        document.removeEventListener('visibilitychange', this.onVisibility);

        this.clearRipples();
        this.clock.dispose();
    }

    /** Запускает проход с начала. Имя `start`, потому что `play` занято входом. */
    start(): void {
        this.replay();
    }

    /** Останавливает сцену и запускает её заново с первого кадра. */
    replay(): void {
        untracked(() => {
            this.paused.set(false);
            this.begin(this.script(), this.initial(), this.poster());
        });
    }

    /** Пауза: замирают и ожидания сценария, и переходы между проходами. */
    pause(): void {
        this.paused.set(true);
        this.clock.pause();
    }

    /** Снимает паузу; вне вьюпорта сцена всё равно останется замороженной. */
    resume(): void {
        this.paused.set(false);
        this.syncClock();
    }

    /** Собирает проход: гасит прошлый запуск и решает, что показывать. */
    private begin(script: Script<SceneState>, initial: SceneState, poster: SceneState | null): void {
        this.stop();

        this.script$ = script;
        this.base = initial;
        this.state.set(initial);

        if (!motionAllowed()) {
            // Под reduced-motion не запускаем ничего: виден финальный кадр.
            this.state.set(poster ?? initial);

            return;
        }

        if (!this.ready) {
            this.queued = true;

            return;
        }

        this.launch();
    }

    /** Новый `Act` и новый сигнал: прошлый запуск уже отменён. */
    private launch(): void {
        const root = this.stageEl()?.nativeElement;

        if (!root) {
            return;
        }

        const controller = new AbortController();
        const signal = controller.signal;

        this.controller = controller;

        const act = createAct<SceneState>({
            root,
            cursor: (this.cursorEl()?.nativeElement as HTMLElement | undefined) ?? null,
            signal,
            clock: this.clock,
            state: () => this.state(),
            put: (patch) => this.patch(patch),
            setKind: (kind) => this.kind.set(kind),
            setKeys: (keys) => this.keys.set(keys),
            scale: () => this.scale(),
            pos: this.pos,
            ripple: (point) => this.ripple(point)
        });

        this.syncClock();
        act.place(this.cursorAt());

        void this.run(act, signal);
    }

    /** Проход за проходом: сценарий, гашение, снова сценарий. */
    private async run(act: Act<SceneState>, signal: AbortSignal): Promise<void> {
        const once = untracked(() => this.play()) === 'once';

        try {
            do {
                this.runCount.update((count) => count + 1);
                await this.script$(act);

                if (signal.aborted || once) {
                    return;
                }

                await this.gap(act, signal);
            } while (!signal.aborted);
        } catch (error) {
            // `Stopped` — штатный конец запуска, всё остальное — ошибка сценария.
            if (!(error instanceof Stopped)) {
                console.error('time-input: сценарий упал', error);
            }
        } finally {
            if (this.controller?.signal === signal) {
                this.controller = null;
            }
        }
    }

    /** Разрыв между проходами: погасить, вернуть начало, проявить, устояться. */
    private async gap(act: Act<SceneState>, signal: AbortSignal): Promise<void> {
        this.resetting.set(true);
        await this.after(FADE_MS, signal);

        this.state.set(this.base ?? this.initial());
        act.place(this.cursorAt());

        await this.after(FADE_MS, signal);
        this.resetting.set(false);

        await this.after(SETTLE_MS, signal);
    }

    /** Ожидание через часы сцены: отмена снимает таймер и завершает проход. */
    private after(ms: number, signal: AbortSignal): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (signal.aborted) {
                reject(new Stopped());

                return;
            }

            let settled = false;
            let timer = 0;

            const done = (): void => {
                if (settled) {
                    return;
                }

                settled = true;
                signal.removeEventListener('abort', stopped);
                resolve();
            };

            const stopped = (): void => {
                if (settled) {
                    return;
                }

                settled = true;
                this.clock.clearTimeout(timer);
                reject(new Stopped());
            };

            timer = this.clock.timeout(done, ms);
            signal.addEventListener('abort', stopped, { once: true });

            if (signal.aborted) {
                stopped();
            }
        });
    }

    /** Снимает запуск: сигнал, состояние сцены и всё, что нарисовано поверх. */
    private stop(): void {
        this.controller?.abort();
        this.controller = null;

        this.resetting.set(false);
        this.keys.set(null);
        this.clearRipples();
        this.ripples.set([]);
    }

    /** Патч состояния: `Act` не знает, как устроен `SceneState`. */
    private patch(patch: Patch<SceneState>): void {
        this.state.update((current) => ({
            ...current,
            ...(typeof patch === 'function' ? patch(current) : patch)
        }));
    }

    /** Волна клика живёт по часам сцены: на паузе она тоже стоит. */
    private ripple(point: Point): void {
        const id = ++this.rippleSeq;

        this.ripples.update((list) => [...list, { id, x: point.x, y: point.y }]);

        const timer = this.clock.timeout(() => {
            this.rippleTimers.delete(timer);
            this.ripples.update((list) => list.filter((item) => item.id !== id));
        }, RIPPLE_MS);

        this.rippleTimers.add(timer);
    }

    private clearRipples(): void {
        for (const timer of this.rippleTimers) {
            this.clock.clearTimeout(timer);
        }

        this.rippleTimers.clear();
    }

    /** Масштаб по месту: кадр не растягивается больше единицы. */
    private measure(): void {
        const fit = this.fit()?.nativeElement;

        if (!fit) {
            return;
        }

        const available = fit.getBoundingClientRect().width;

        // Нулевая ширина — ещё не раскладка, а не «места нет»: держим прошлый замер.
        if (!(available > 0)) {
            return;
        }

        this.available.set(available);
    }

    private observeFit(): void {
        const fit = this.fit()?.nativeElement;

        if (!fit || typeof ResizeObserver !== 'function') {
            return;
        }

        this.resizeObserver = new ResizeObserver(() => this.measure());
        this.resizeObserver.observe(fit);
    }

    /** Вне вьюпорта и в скрытой вкладке сцена замирает, но не сбрасывается. */
    private observeVisibility(): void {
        const fit = this.fit()?.nativeElement;

        if (fit && typeof IntersectionObserver === 'function') {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                const entry = entries[entries.length - 1];

                if (entry) {
                    this.setAway(!entry.isIntersecting);
                }
            });
            this.intersectionObserver.observe(fit);
        }

        document.addEventListener('visibilitychange', this.onVisibility);
        this.setAway(document.hidden);
    }

    private readonly onVisibility = (): void => this.setAway(document.hidden);

    private setAway(away: boolean): void {
        if (this.away() === away) {
            return;
        }

        this.away.set(away);
        this.syncClock();
    }

    /** Часы стоят, если пауза попрошена или сцены не видно. */
    private syncClock(): void {
        if (this.paused() || this.away()) {
            this.clock.pause();
        } else {
            this.clock.resume();
        }
    }
}
