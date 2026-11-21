import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    signal,
    viewChild,
    ViewEncapsulation
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ErrorStateMatcher } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqSkeletonModule } from '@koobiq/components/skeleton';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqInputModule } from '@koobiq/components/input';
import { Scenario, isTyping } from '../scenarios/scenarios';
import { SceneState } from './scene-state';

/** Точность координат сцены: субпиксель с запасом, без мусора float-арифметики. */
const PRECISION = 100;

const tidy = (value: number): number => Math.round(value * PRECISION) / PRECISION;

/**
 * Левая граница элемента в пикселях раскладки: сумма `offsetLeft` до `boundary`.
 *
 * `offsetLeft` — геометрия раскладки, её не касается `transform: scale` на предке,
 * поэтому значение годится для координат внутри `.stage`, а не только окна.
 */
function layoutLeft(element: HTMLElement, boundary: HTMLElement): number {
    let left = 0;

    for (let node: HTMLElement | null = element; node && node !== boundary; node = node.offsetParent as HTMLElement | null) {
        left += node.offsetLeft;
    }

    return left;
}

/** Верхняя граница элемента в пикселях раскладки: сумма `offsetTop` до `boundary`. */
function layoutTop(element: HTMLElement, boundary: HTMLElement): number {
    let top = 0;

    for (let node: HTMLElement | null = element; node && node !== boundary; node = node.offsetParent as HTMLElement | null) {
        top += node.offsetTop;
    }

    return top;
}

/**
 * Ошибка поля живёт в состоянии сцены, а не в форме: матчер отдаёт её
 * `kbq-form-field`, поэтому подсветка и текст ошибки — штатные.
 */
class SceneErrorStateMatcher implements ErrorStateMatcher {
    constructor(private readonly hasError: () => boolean) {}

    isErrorState(): boolean {
        return this.hasError();
    }
}

/**
 * Сцена — фрагмент продукта: сообщение-источник, форма «Новая встреча» с полем
 * времени, плашка автозамены и каретка. Сцена ничего не решает: значение, фокус,
 * выделение и подпись приходят готовым `SceneState`, поэтому одна и та же разметка
 * проигрывает и вставку, и ввод.
 *
 * Поле декоративное: `readonly` и `tabindex="-1"`, `focus()` не вызывается — фокус
 * рисуется классом `.cdk-focused` на `kbq-form-field`, а каретка отдельным элементом
 * по замеру зеркального спана. Так сцена не отнимает фокус у кнопок плеера.
 */
@Component({
    selector: 'time-input-scene',
    imports: [KbqFormFieldModule, KbqIconModule, KbqInputModule, KbqSkeletonModule, ReactiveFormsModule],
    template: `
        <section class="scene" [class.scene_typing]="typing()">
            @if (!typing()) {
                <article class="scene__message" data-target="message">
                    <!-- Одной строкой: pre-wrap показывает любой перенос в разметке. -->
                    <p class="scene__text" data-cursor="ibeam"><span class="scene__anchor" data-target="text-start" aria-hidden="true"></span><span>{{ before() }}</span><mark class="scene__mark">{{ selected() }}</mark><span>{{ after() }}</span><span class="scene__anchor" data-target="text-end" aria-hidden="true"></span><span class="scene__anchor" data-target="park" aria-hidden="true"></span></p>
                </article>
            }

            <form novalidate class="scene__form">
                <!-- Точка покоя сценариев ввода: у них нет сообщения, курсор ждёт у колонки. -->
                <span class="scene__park" data-target="park" aria-hidden="true"></span>

                <!-- Остальные поля формы — заглушки: скелетоны без анимации, как в макете. -->
                <kbq-skeleton-form-field class="scene__ghost" />

                <div class="scene__row_time">
                    <label class="kbq-form__label scene__label">Время</label>
                    <div class="kbq-form__control scene__control">
                        <div class="scene__field-box">
                            <kbq-form-field
                                class="scene__field_time"
                                data-target="field"
                                data-cursor="ibeam"
                                [class.cdk-focused]="state().focused"
                            >
                                <i kbq-icon="kbq-clock_16" kbqPrefix></i>
                                <input
                                    kbqInput
                                    readonly
                                    tabindex="-1"
                                    placeholder="ЧЧ:ММ"
                                    [formControl]="control"
                                    [errorStateMatcher]="errorMatcher"
                                />
                                @if (state().field.error) {
                                    <kbq-error>{{ state().field.error }}</kbq-error>
                                } @else if (state().field.hint) {
                                    <kbq-hint>{{ state().field.hint }}</kbq-hint>
                                }
                            </kbq-form-field>
                            <!-- Распознанное значение — тултип над полем: под узким полем ему тесно. -->
                            @if (state().field.recognized) {
                                <div class="scene__tooltip kbq-text-compact" data-target="hint">
                                    Распознано как {{ state().field.recognized }}
                                </div>
                            }
                        </div>
                        <span class="scene__mirror" #mirror aria-hidden="true">{{ state().field.value }}</span>
                        <!--
                            Каретка, как в Stageshow: стоит в потоке после текста и
                            пересоздаётся на каждый символ, поэтому при наборе она
                            горит ровно, а мигает только когда набор остановился.
                        -->
                        @for (caret of [state().field.value.length]; track caret) {
                            <span
                                class="scene__caret"
                                [class.scene__caret_visible]="state().focused"
                                [style.left.px]="caretLeft()"
                                [style.top.px]="caretTop()"
                                aria-hidden="true"
                            ></span>
                        }
                    </div>
                </div>

                <kbq-skeleton-form-field class="scene__ghost" />
                <kbq-skeleton-form-field class="scene__ghost" />
                <kbq-skeleton-form-field class="scene__ghost" />
            </form>

            @if (state().toast) {
                <div class="scene__toast kbq-text-compact" role="status">{{ state().toast }}</div>
            }
        </section>
    `,
    styleUrl: './scene.component.scss',
    host: {
        '[class.scene_paused]': 'paused()'
    },
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SceneComponent implements AfterViewInit {
    readonly state = input.required<SceneState>();
    readonly scenario = input.required<Scenario>();
    /** Пауза плеера: каретка перестаёт мигать, чтобы пауза читалась как пауза. */
    readonly paused = input(false);

    readonly typing = computed(() => isTyping(this.scenario()));

    /** Текст сообщения, разложенный на части: до выделения, выделение и после. */
    readonly before = computed(() => {
        const selection = this.state().selection;

        return selection ? this.scenario().clipboard.slice(0, selection[0]) : this.scenario().clipboard;
    });

    readonly selected = computed(() => {
        const selection = this.state().selection;

        return selection ? this.scenario().clipboard.slice(selection[0], selection[1]) : '';
    });

    readonly after = computed(() => {
        const selection = this.state().selection;

        return selection ? this.scenario().clipboard.slice(selection[1]) : '';
    });

    /** До первого замера каретка стоит у левого края поля. */
    readonly caretLeft = signal(0);

    /** Каретка стоит по центру строки поля, а не строки с подсказкой под полем. */
    readonly caretTop = signal(0);

    /**
     * Состояние ошибки `kbq-form-field` показывает по `errorState` контрола, а его
     * обновляет матчер, — поэтому поле сцены живёт на настоящем `FormControl`.
     */
    readonly control = new FormControl('', { nonNullable: true });
    /** Ошибки в форме нет: её отдаёт состояние сцены. */
    readonly errorMatcher = new SceneErrorStateMatcher(() => !!this.state().field.error);

    private readonly mirror = viewChild<ElementRef<HTMLElement>>('mirror');
    private readonly destroyRef = inject(DestroyRef);
    private observer: ResizeObserver | null = null;

    constructor() {
        effect(() => {
            // Контрол держит текст поля: поле сцены только показывает его.
            this.control.setValue(this.state().field.value, { emitEvent: false });
        });

        effect(() => {
            this.state().field.value;

            // Замер — не анимация: он может идти в кадре, но по нему ничего не ждёт.
            this.schedule();
        });
    }

    ngAfterViewInit(): void {
        this.observe();
    }

    /**
     * Кадр складывается (720 ↔ 360) и сжимается по месту, а значение поля при этом
     * не меняется — поэтому замер повторяется и по размеру обёртки поля, а не
     * только по значению. Наблюдатель, а не опрос: на паузе и вне вьюпорта он молчит.
     */
    private observe(): void {
        const control = this.mirror()?.nativeElement.parentElement;

        if (!control || typeof ResizeObserver !== 'function') {
            return;
        }

        this.observer = new ResizeObserver(() => this.schedule());
        this.observer.observe(control);
        this.destroyRef.onDestroy(() => this.observer?.disconnect());
    }

    /** Замер откладывается на кадр: в колбэке наблюдателя раскладка ещё не досчитана. */
    private schedule(): void {
        requestAnimationFrame(() => this.measure());
    }

    /**
     * Каретка меряется в пикселях раскладки: и положение поля, и ширина зеркала
     * сняты `offset*`, которые не масштабируются вместе со сценой. Кадр же
     * масштабируется целиком (`transform: scale`), поэтому оконные дельты на
     * `scale ≠ 1` ставили каретку левее конца текста — внутрь последней цифры.
     */
    private measure(): void {
        const mirror = this.mirror()?.nativeElement;
        const control = mirror?.parentElement;
        const input = control?.querySelector('input');

        if (!mirror || !control || !input) {
            return;
        }

        const style = getComputedStyle(input);

        mirror.style.font = style.font;
        mirror.style.letterSpacing = style.letterSpacing;

        const inset = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0);

        /*
         * Поле времени узкое: длинный текст обрезается его краем, и каретка за
         * краем пропала бы. Прижимаем её к правому краю поля — там же, где
         * кончается видимый текст. Без раскладки (clientWidth = 0) прижимать
         * некуда: там считается только текст.
         */
        const text = inset + mirror.offsetWidth;
        const edge = input.clientWidth > 0 ? Math.min(text, input.clientWidth) : text;

        this.caretLeft.set(tidy(layoutLeft(input, control) + edge));
        this.caretTop.set(tidy(layoutTop(input, control) + input.offsetHeight / 2));
    }
}
