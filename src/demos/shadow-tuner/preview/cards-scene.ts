import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbqBadgeColors, KbqBadgeModule } from '@koobiq/components/badge';
import { KbqButtonModule } from '@koobiq/components/button';
import { FormsModule } from '@angular/forms';
import { KbqComponentColors, KbqOptionModule } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqSelectModule } from '@koobiq/components/select';

/** Плитка дашборда и карточки списка: у Кубика нет компонента карточки, это `--kbq-shadow-card` на плашке. */
@Component({
    selector: 'app-cards-scene',
    imports: [
        FormsModule,
        KbqBadgeModule,
        KbqButtonModule,
        KbqFormFieldModule,
        KbqIconModule,
        KbqOptionModule,
        KbqSelectModule
    ],
    template: `
        <section class="scene">
            <h2 class="scene__title">Плитка и карточки</h2>
            <p class="scene__note">
                Плашки с <code>box-shadow: var(--kbq-shadow-card)</code> на фоне приложения. Открытый селект — копия
                панели на <code>--kbq-shadow-popup</code> поверх карточек. Последняя карточка — обводка
                <code>line-contrast-less</code> без тени, для сравнения.
            </p>

            <div class="period" aria-hidden="true">
                <kbq-form-field class="period__field">
                    <kbq-select name="period" tabindex="-1" [ngModel]="periods[1]">
                        @for (period of periods; track period) {
                            <kbq-option [value]="period">{{ period }}</kbq-option>
                        }
                    </kbq-select>
                </kbq-form-field>
                <div class="kbq-select__panel period__panel" data-target="cards-select">
                    <div class="kbq-select__content">
                        @for (period of periods; track period; let i = $index) {
                            <kbq-option [value]="period" [class.kbq-selected]="i === 1">{{ period }}</kbq-option>
                        }
                    </div>
                </div>
            </div>

            <div class="cards">
                <article class="card" data-target="card">
                    <div class="card__head">
                        <i kbq-icon="kbq-shield-check_16" [color]="colors.Success"></i>
                        <span class="card__title">Защита конечных точек</span>
                    </div>
                    <p class="card__text">2 340 агентов онлайн, 12 требуют обновления баз.</p>
                    <div class="card__actions">
                        <button kbq-button [color]="colors.Contrast">Обновить</button>
                        <button kbq-button [color]="colors.ContrastFade">Подробнее</button>
                    </div>
                </article>
                <article class="card">
                    <div class="card__head">
                        <i kbq-icon="kbq-triangle-exclamation_16" [color]="colors.Error"></i>
                        <span class="card__title">Инциденты</span>
                        <kbq-badge [badgeColor]="badgeColors.FadeError">2 критичных</kbq-badge>
                    </div>
                    <p class="card__text">7 открытых. Последний создан 4 минуты назад.</p>
                    <div class="card__actions">
                        <button kbq-button [color]="colors.ContrastFade">Открыть список</button>
                    </div>
                </article>
                <article class="card">
                    <div class="card__head">
                        <i kbq-icon="kbq-clock_16" [color]="colors.ContrastFade"></i>
                        <span class="card__title">Отчёт за неделю</span>
                    </div>
                    <p class="card__text">Готов к выгрузке: PDF, 18 страниц.</p>
                    <div class="card__actions">
                        <button kbq-button [color]="colors.ContrastFade">Скачать</button>
                    </div>
                </article>
                <article class="card card_outline" data-target="outlined-card">
                    <div class="card__head">
                        <i kbq-icon="kbq-server_16" [color]="colors.ContrastFade"></i>
                        <span class="card__title">Источники данных</span>
                    </div>
                    <p class="card__text">Обводка вместо тени: 14 источников, 1 не отвечает.</p>
                    <div class="card__actions">
                        <button kbq-button [color]="colors.ContrastFade">Настроить</button>
                    </div>
                </article>
            </div>

            <div class="tiles">
                @for (tile of tiles; track tile.label) {
                    <div class="tile" data-target="tile">
                        <span class="tile__label">{{ tile.label }}</span>
                        <span class="tile__value">{{ tile.value }}</span>
                        <span class="tile__delta" [class.tile__delta_bad]="tile.bad">{{ tile.delta }}</span>
                    </div>
                }
            </div>
        </section>
    `,
    styles: `
        @use './scene';
        @use '@koobiq/components/core/styles/common/squircle' as *;

        /* Открытый селект: копия панели висит поверх карточек под полем. */
        /* Поле уже панели: как у настоящего селекта, панель не сужается меньше KBQ_PANEL_DEFAULT_MIN_WIDTH (200px). */
        .period {
            position: relative;
            z-index: 1;
            width: 120px;
            margin-bottom: var(--kbq-size-l);
            pointer-events: none;
        }

        .period__field {
            width: 100%;
        }

        .period__panel {
            position: absolute;
            top: calc(100% + var(--kbq-size-xxs));
            left: 0;
            width: 200px;
        }

        .tiles {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: var(--kbq-size-l);
        }

        .tile {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-xxs);
            padding: var(--kbq-size-l) var(--kbq-size-xl);
            background: var(--kbq-background-card);
            box-shadow: var(--kbq-shadow-card);
            @include kbq-squircle(var(--kbq-size-l));
        }

        .tile__label {
            color: var(--kbq-foreground-contrast-secondary);
        }

        .tile__value {
            font-size: var(--kbq-typography-headline-font-size);
            font-weight: var(--kbq-typography-headline-font-weight);
            line-height: var(--kbq-typography-headline-line-height);
            letter-spacing: var(--kbq-typography-headline-letter-spacing);
            font-feature-settings: var(--kbq-typography-headline-font-feature-settings);
        }

        .tile__delta {
            color: var(--kbq-foreground-success);
            font-size: var(--kbq-typography-text-compact-font-size);
        }

        .tile__delta_bad {
            color: var(--kbq-foreground-error);
        }

        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: var(--kbq-size-l);
        }

        .card {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-s);
            padding: var(--kbq-size-l) var(--kbq-size-xl);
            background: var(--kbq-background-card);
            box-shadow: var(--kbq-shadow-card);
            /* Плашка карточки — базовый радиус компонентов Кубика, без squircle-скругления. */
            border-radius: var(--kbq-size-border-radius);
        }

        .card_outline {
            box-shadow: 0 0 0 1px var(--kbq-line-contrast-less);
        }

        .card__head {
            display: flex;
            align-items: center;
            gap: var(--kbq-size-s);
        }

        .card__title {
            flex: 1;
            font-weight: var(--kbq-typography-text-normal-strong-font-weight);
        }

        .card__text {
            flex: 1;
            margin: 0;
            color: var(--kbq-foreground-contrast-secondary);
        }

        .card__actions {
            display: flex;
            flex-wrap: wrap;
            gap: var(--kbq-size-s);
            margin-top: var(--kbq-size-s);
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardsScene {
    protected readonly colors = KbqComponentColors;
    protected readonly badgeColors = KbqBadgeColors;

    protected readonly periods = ['За сутки', 'За 7 дней', 'За 30 дней', 'За квартал'];

    protected readonly tiles = [
        { label: 'События за сутки', value: '1,2 млн', delta: '+8 %', bad: false },
        { label: 'Инциденты', value: '7', delta: '+2 за час', bad: true },
        { label: 'Активы', value: '2 340', delta: '+14', bad: false },
        { label: 'Уязвимости', value: '318', delta: '−21', bad: false }
    ];
}
