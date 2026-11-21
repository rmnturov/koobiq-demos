import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';

import { ELEVATION_LABELS } from '../model/shadow-labels';
import { ELEVATIONS } from '../model/shadow-model';
import { ShadowStore } from '../model/shadow-store';

@Component({
    selector: 'app-levels-scene',
    imports: [KbqButtonToggleModule],
    template: `
        <section class="scene">
            <div class="scene__head">
                <h2 class="scene__title">Уровни</h2>
                <kbq-button-toggle-group
                    data-target="backdrop"
                    [value]="store.backdrop()"
                    [disabled]="store.locked()"
                    (change)="store.setBackdrop($event.value)"
                >
                    <kbq-button-toggle value="bg">bg</kbq-button-toggle>
                    <kbq-button-toggle value="bg-secondary">bg-secondary</kbq-button-toggle>
                </kbq-button-toggle-group>
            </div>

            <div class="levels" [class]="'levels_' + store.backdrop()">
                @for (item of items; track item.id) {
                    <figure class="levels__item">
                        <div class="levels__tile" [attr.data-target]="'tile-' + item.id" [style.box-shadow]="item.shadow"></div>
                        <figcaption class="levels__name">{{ item.label }}</figcaption>
                    </figure>
                }
            </div>
        </section>
    `,
    styles: `
        @use './scene';
        @use '@koobiq/components/core/styles/common/squircle' as *;

        .levels {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: var(--kbq-size-4xl);
            padding: var(--kbq-size-4xl);
            @include kbq-squircle(var(--kbq-size-l));
        }

        .levels_bg {
            background: var(--kbq-background-bg);
            box-shadow: inset 0 0 0 1px var(--kbq-line-contrast-less);
        }

        .levels_bg-secondary {
            background: var(--kbq-background-bg-secondary);
        }

        .levels__item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: var(--kbq-size-xl);
            margin: 0;
        }

        .levels__tile {
            width: 140px;
            height: 140px;
            background: var(--kbq-background-card);
            @include kbq-squircle(var(--kbq-size-l));
        }

        .levels__name {
            font-weight: var(--kbq-typography-text-normal-strong-font-weight);
            text-align: center;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LevelsScene {
    protected readonly store = inject(ShadowStore);

    /** Первым — точка отсчёта: однопиксельная обводка цвета `line-contrast-less`, без настройки. */
    protected readonly items = [
        { id: 'outline', label: 'Обводка', shadow: '0 0 0 1px var(--kbq-line-contrast-less)' },
        ...ELEVATIONS.map((elevation) => ({
            id: elevation,
            label: ELEVATION_LABELS[elevation],
            shadow: `var(--kbq-shadow-${elevation})`
        }))
    ];
}
