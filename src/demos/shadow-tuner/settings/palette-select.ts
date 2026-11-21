import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqOptionModule } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqSelectModule } from '@koobiq/components/select';

import { ALPHA_SLOTS, Layer, LayerColor, SOLID_SLOTS, Scheme, layerColorValue, layerVar } from '../model/shadow-model';

/**
 * Выбор слота палитры с образцом цвета. С входом `token` первым идёт общий токен слоя
 * (`--kbq-shadow-key` и т. п.) — значение `'token'`.
 *
 * Образец рисуется в `kbq-select-trigger`, а не в `kbq-select-matcher`: матчер заменяет триггер
 * целиком вместе со стрелкой, а триггер подменяет только текст значения.
 */
@Component({
    selector: 'app-palette-select',
    imports: [FormsModule, KbqFormFieldModule, KbqOptionModule, KbqSelectModule],
    host: {
        '[class.locked]': 'locked()'
    },
    template: `
        <kbq-form-field>
            @if (label()) {
                <kbq-label>{{ label() }}</kbq-label>
            }
            <kbq-select
                [attr.aria-label]="ariaLabel()"
                [disabled]="locked()"
                [ngModel]="value()"
                (ngModelChange)="valueChange.emit($event)"
            >
                <ng-container kbq-select-trigger>
                    <span class="trigger">
                        <span
                            class="swatch"
                            [class.swatch_empty]="value() === 'transparent'"
                            [style.background]="swatch(value())"
                        ></span>
                        <span class="trigger__text">{{ caption(value()) }}</span>
                    </span>
                </ng-container>

                <kbq-option value="transparent">
                    <span class="swatch swatch_empty"></span>
                    transparent
                </kbq-option>
                <kbq-option value="line">
                    <span class="swatch" [style.background]="swatch('line')"></span>
                    line-contrast-less
                </kbq-option>
                @if (token()) {
                    <kbq-option value="token">
                        <span class="swatch" [style.background]="swatch('token')"></span>
                        {{ caption('token') }}
                    </kbq-option>
                }
                <kbq-optgroup label="С альфой, a1…a20">
                    @for (slot of alphaSlots; track slot) {
                        <kbq-option [value]="slot">
                            <span class="swatch" [style.background]="swatch(slot)"></span>
                            {{ slot }}
                        </kbq-option>
                    }
                </kbq-optgroup>
                <kbq-optgroup label="Без прозрачности">
                    @for (slot of solidSlots; track slot) {
                        <kbq-option [value]="slot">
                            <span class="swatch" [style.background]="swatch(slot)"></span>
                            {{ slot }}
                        </kbq-option>
                    }
                </kbq-optgroup>
            </kbq-select>
        </kbq-form-field>
    `,
    styles: `
        :host {
            display: block;
            min-width: 0;
        }

        /*
        «Было» держит выбор заблокированным ([disabled], серые токены отключения), но выглядит
        как активный: токены отключения переприсваиваются дефолтным значениям поля, а каретка
        селекта скрывается. Токены формы объявлены на самом kbq-form-field, поэтому перебиваются
        на нём: наследование от хоста их не достаёт.
        */
        :host.locked kbq-form-field {
            --kbq-form-field-states-disabled-border-color: var(--kbq-form-field-default-border-color);
            --kbq-form-field-states-disabled-background: var(--kbq-form-field-default-background);
        }

        /* Цвет текста селекта читает токен состояний — он объявлен выше по дереву, хватает хоста. */
        :host.locked {
            --kbq-states-foreground-disabled: var(--kbq-foreground-contrast);
        }

        /* Каретка живёт в шаблоне самого kbq-select, поэтому без ::ng-deep её не достать. */
        :host.locked ::ng-deep .kbq-select__arrow-wrapper {
            display: none;
        }

        /* Матчер селекта растягивает первого ребёнка, поэтому образец и подпись — в одной обёртке. */
        .trigger {
            display: flex;
            align-items: center;
            min-width: 0;
        }

        .trigger__text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .swatch {
            display: inline-block;
            flex: none;
            width: 16px;
            height: 16px;
            margin-inline-end: var(--kbq-size-s);
            vertical-align: -3px;
            border-radius: var(--kbq-size-xxs);
            box-shadow: inset 0 0 0 1px var(--kbq-line-contrast-less);
        }

        .swatch_empty {
            background: linear-gradient(
                to top right,
                transparent calc(50% - 0.5px),
                var(--kbq-line-error) calc(50% - 0.5px),
                var(--kbq-line-error) calc(50% + 0.5px),
                transparent calc(50% + 0.5px)
            ) !important;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaletteSelect {
    readonly value = input.required<LayerColor>();
    readonly scheme = input.required<Scheme>();
    /** Слой, чей общий токен предлагается первым пунктом. Без него — только слоты палитры. */
    readonly token = input<Layer | null>(null);
    readonly label = input<string>('');
    readonly ariaLabel = input<string | null>(null);
    /**
     * «Было» показывает прежнее значение: выбор заблокирован, но выглядит как активный селект
     * без каретки — серую покраску отключения гасит класс locked в стилях компонента.
     */
    readonly locked = input(false);

    readonly valueChange = output<LayerColor>();

    protected readonly alphaSlots = ALPHA_SLOTS;
    protected readonly solidSlots = SOLID_SLOTS;

    private readonly tokenName = computed(() => {
        const layer = this.token();

        return layer ? layerVar(layer).replace('--kbq-', '') : '';
    });

    protected swatch(color: LayerColor): string {
        return layerColorValue(this.token() ?? 'key', color, this.scheme());
    }

    protected caption(color: LayerColor): string {
        if (color === 'token') return this.tokenName();

        return color === 'line' ? 'line-contrast-less' : color;
    }
}
