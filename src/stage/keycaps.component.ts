/**
 * Кепки клавиш: что нажал сценарий — то и видно в углу сцены.
 *
 * Показ и нажатие идут через `data-show`/`data-down` на хосте: элемент всегда в
 * DOM, поэтому гашение — переход, а не мгновенное исчезновение. Последнее комбо
 * остаётся в разметке и после `setKeys(null)` — иначе кепки пропадали бы раньше,
 * чем успевали погаснуть.
 */

import { ChangeDetectionStrategy, Component, computed, effect, input, signal, ViewEncapsulation } from '@angular/core';
import { KeyState } from './act';
import { capsOf } from './keys';

@Component({
    selector: 'time-input-keycaps',
    template: `
        @for (cap of caps(); track $index) {
            <kbd class="keys__cap kbq-text-normal">{{ cap }}</kbd>
        }
    `,
    styleUrl: './keycaps.component.scss',
    host: {
        class: 'stage__keys',
        '[attr.data-show]': "show() ? '' : null",
        '[attr.data-down]': "down() ? '' : null",
        'aria-hidden': 'true'
    },
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class KeycapsComponent {
    /** Что показывает сценарий: комбо, видимость и нажатие. `null` — гасим. */
    readonly keys = input<KeyState | null>(null);

    readonly show = computed(() => this.keys()?.show === true);
    readonly down = computed(() => this.keys()?.down === true);

    /** Символы последнего показанного комбо: переживают гашение. */
    readonly caps = signal<readonly string[]>([]);

    constructor() {
        effect(() => {
            const keys = this.keys();

            if (keys) {
                this.caps.set(capsOf(keys.combo));
            }
        });
    }
}
