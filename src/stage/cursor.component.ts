/**
 * Курсор сцены: декоративный слой, который двигает `Act`.
 *
 * Позицию задаёт не шаблон, а `Act`: он пишет `transform` прямо в стиль хоста и
 * ставит `data-pressed` при нажатии. Шаблон владеет только видом — стрелка,
 * I-beam или рука по `data-kind`, — потому что вид меняется редко и без замеров.
 *
 * Глифы — системные курсоры macOS, как в Stageshow: белая заливка с чёрным
 * контуром читается и на светлой, и на тёмной сцене. Горячая точка у каждого
 * глифа своя и вынесена в SCSS: точка отсчёта хоста — она и есть место клика.
 *
 * Курсор ничего не ловит: `pointer-events: none`, без фокуса и без ввода.
 */

import {
    ChangeDetectionStrategy,
    Component,
    effect,
    ElementRef,
    inject,
    input,
    untracked,
    viewChild,
    ViewEncapsulation
} from '@angular/core';
import { CursorKind } from './measure';

@Component({
    selector: 'time-input-cursor',
    template: `
        <span class="cursor__ripple" #ripple></span>
        <div class="cursor__press">
            <div class="cursor__glyph" data-glyph="pointer">
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <g transform="translate(10 7)">
                        <path d="m6.148 18.473 1.863-1.003 1.615-.839-2.568-4.816h4.332l-11.379-11.408v16.015l3.316-3.221z" fill="#fff" />
                        <path d="m6.431 17 1.765-.941-2.775-5.202h3.604l-8.025-8.043v11.188l2.53-2.442z" fill="#000" />
                    </g>
                </svg>
            </div>
            <div class="cursor__glyph" data-glyph="ibeam">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="none" overflow="visible" aria-hidden="true">
                    <path class="cursor__ibeam_edge" d="M3 1H7M3 15H7M5 1V15" stroke-width="2.6" stroke-linecap="round" />
                    <path class="cursor__ibeam_line" d="M3 1H7M3 15H7M5 1V15" stroke-width="1" stroke-linecap="round" />
                </svg>
            </div>
            <div class="cursor__glyph" data-glyph="hand">
                <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <path
                        d="M10.6 6a1.7 1.7 0 0 1 3.4 0v6.6a1.3 1.3 0 0 1 2.6 0v.7a1.3 1.3 0 0 1 2.6 0v.7a1.3 1.3 0 0 1 2.6 0V19c0 3.1-2 5.6-5 5.6h-2.6c-2 0-3.3-.9-4.4-2.4l-3.1-4.1c-.6-.9-.4-2 .5-2.5.8-.4 1.7-.2 2.3.5l1.1 1.4V6Z"
                        fill="#fff"
                        stroke="#000"
                        stroke-width="1.1"
                        stroke-linejoin="round"
                    />
                    <path d="M14 12.6v3.6M16.6 13.3v3M19.2 14v2.6" stroke="#000" stroke-width="1" stroke-linecap="round" />
                </svg>
            </div>
        </div>
    `,
    styleUrl: './cursor.component.scss',
    host: {
        class: 'stage__cursor',
        '[attr.data-kind]': 'kind()',
        'aria-hidden': 'true'
    },
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CursorComponent {
    /** Вид под точкой: стрелка для `default`/`hand`, I-beam для текста. */
    readonly kind = input<CursorKind>('default');

    /**
     * Номер нажатия: каждое новое значение посылает от точки клика кольцо. Счетчик, а не
     * флаг, потому что два нажатия подряд должны дать два кольца, а не одно длинное.
     */
    readonly press = input(0);

    /**
     * Кольцо живет в шаблоне, а не создается руками: элемент из `document.createElement`
     * не получает атрибут эмуляции вида и остался бы без стилей.
     */
    private readonly rippleEl = viewChild<ElementRef<HTMLElement>>('ripple');

    constructor() {
        effect(() => {
            const count = this.press();

            if (count === 0) {
                return;
            }

            untracked(() => this.ripple());
        });
    }

    /**
     * Кольцо расходится из точки клика и гаснет — эффект нажатия, как в Stageshow
     * (`ripple`): 36 px, акцентная обводка, 0.2 → 1 за 0.55 с. Рисуется императивно:
     * анимацию надо запускать заново на каждое нажатие, а CSS-анимация с тем же
     * именем второй раз не перезапустится.
     */
    private ripple(): void {
        // Без `matchMedia` (jsdom) движение считаем разрешенным: вид кольца проверяется в браузере.
        if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const ring = this.rippleEl()?.nativeElement;

        // В jsdom анимаций нет: кольцо остается в базовом состоянии — его не видно.
        if (!ring || typeof ring.animate !== 'function') {
            return;
        }

        ring.animate(
            [
                { transform: 'scale(0.2)', opacity: '1' },
                { transform: 'scale(1)', opacity: '0' }
            ],
            { duration: 550, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)' }
        );
    }
}
