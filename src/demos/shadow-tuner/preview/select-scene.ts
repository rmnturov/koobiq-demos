import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqOptionModule } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqSelectModule } from '@koobiq/components/select';

/**
 * Настоящая панель селекта закрывается на любой клик снаружи — а значит, на каждый клик по форме.
 * Поэтому здесь её копия на тех же классах `kbq-select__panel` / `kbq-select__content`:
 * стили панели глобальные и подгружаются вместе с полем селекта над ней.
 */
@Component({
    selector: 'app-select-scene',
    imports: [FormsModule, KbqFormFieldModule, KbqOptionModule, KbqSelectModule],
    template: `
        <section class="scene">
            <h2 class="scene__title">Выпадашка селекта</h2>
            <p class="scene__note">
                Копия открытой панели селекта на <code>--kbq-shadow-popup</code>: она не закрывается, пока правятся
                числа.
            </p>

            <div class="dropdown">
                <div class="dropdown__static">
                    <kbq-form-field class="dropdown__field">
                        <kbq-select name="static-select" tabindex="-1" [ngModel]="options[1]">
                            @for (option of options; track option) {
                                <kbq-option [value]="option">{{ option }}</kbq-option>
                            }
                        </kbq-select>
                    </kbq-form-field>
                    <div class="kbq-select__panel dropdown__panel" data-target="static-panel" aria-hidden="true">
                        <div class="kbq-select__content">
                            @for (option of options; track option; let i = $index) {
                                <kbq-option [value]="option" [class.kbq-selected]="i === 1">
                                    {{ option }}
                                </kbq-option>
                            }
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `,
    styles: `
        @use './scene';

        .dropdown {
            min-height: 240px;
        }

        /* Ширину задаёт колонка: у kbq-select__panel глобальный min-width: 100% от родителя. */
        .dropdown__static {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-xxs);
            width: 240px;
            pointer-events: none;
        }

        .dropdown__field,
        .dropdown__panel {
            width: 100%;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectScene {
    protected readonly options = ['Все события', 'Инциденты', 'Уязвимости', 'Активы', 'Отчёты'];
}
