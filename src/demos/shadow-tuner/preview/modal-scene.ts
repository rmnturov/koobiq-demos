import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';
import { KbqComponentColors } from '@koobiq/components/core';
import { KbqModalService, ModalSize } from '@koobiq/components/modal';

import { ShadowStore } from '../model/shadow-store';

/**
 * Настоящая модалка — `position: fixed` на весь экран и перекрывает форму, поэтому рядом с формой
 * стоит её копия на токенах `--kbq-modal-*`, а живая открывается кнопкой.
 */
@Component({
    selector: 'app-modal-scene',
    imports: [KbqButtonModule, KbqButtonToggleModule],
    template: `
        <section class="scene">
            <div class="scene__head">
                <h2 class="scene__title">Модалка</h2>
                <div class="actions">
                    <kbq-button-toggle-group
                        data-target="mask"
                        [value]="store.mask()"
                        [disabled]="store.locked()"
                        (change)="store.setMask($event.value)"
                    >
                        <kbq-button-toggle [value]="true">С затемнением</kbq-button-toggle>
                        <kbq-button-toggle [value]="false">Без</kbq-button-toggle>
                    </kbq-button-toggle-group>
                    <button kbq-button data-target="open-modal" [color]="colors.ContrastFade" (click)="open()">
                        Открыть настоящую
                    </button>
                </div>
            </div>
            <p class="scene__note">
                Копия модалки на <code>--kbq-shadow-overlay</code> поверх затемнения. Настоящая перекрывает экран, поэтому
                открывается кнопкой.
            </p>

            <div class="backdrop" [class.backdrop_masked]="store.mask()">
                <div class="dialog" data-target="static-modal" role="presentation">
                    <div class="dialog__header">Удалить правило корреляции?</div>
                    <div class="dialog__body">
                        Правило перестанет создавать инциденты. Уже созданные инциденты останутся в списке.
                    </div>
                    <div class="dialog__footer">
                        <button kbq-button tabindex="-1" [color]="colors.Contrast">Удалить</button>
                        <button kbq-button tabindex="-1" [color]="colors.ContrastFade">Отмена</button>
                    </div>
                </div>
            </div>
        </section>
    `,
    styles: `
        @use './scene';
        @use '@koobiq/components/core/styles/common/squircle' as *;

        .backdrop {
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            padding: var(--kbq-size-7xl) var(--kbq-size-l);
            background: var(--kbq-background-bg-secondary);
            @include kbq-squircle(var(--kbq-size-l));
        }

        .backdrop_masked {
            background:
                linear-gradient(var(--kbq-background-overlay), var(--kbq-background-overlay)),
                var(--kbq-background-bg-secondary);
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: var(--kbq-size-m);
        }

        .dialog {
            width: var(--kbq-modal-size-small-width, 400px);
            max-width: 100%;
            color: var(--kbq-foreground-contrast);
            background: var(--kbq-background-card);
            box-shadow: var(--kbq-shadow-overlay);
            @include kbq-squircle(var(--kbq-size-m));
        }

        .dialog__header {
            padding: var(--kbq-size-l) var(--kbq-size-6xl) var(--kbq-size-l) var(--kbq-size-xxl);
            font-family: var(--kbq-typography-title-font-family);
            font-size: var(--kbq-typography-title-font-size);
            font-weight: var(--kbq-typography-title-font-weight);
            line-height: var(--kbq-typography-title-line-height);
            letter-spacing: var(--kbq-typography-title-letter-spacing);
            font-feature-settings: var(--kbq-typography-title-font-feature-settings);
        }

        .dialog__body {
            padding: 1px var(--kbq-size-xxl) var(--kbq-size-s);
        }

        .dialog__footer {
            display: flex;
            gap: var(--kbq-size-l);
            padding: var(--kbq-size-xl) var(--kbq-size-xxl);
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalScene {
    private readonly modal = inject(KbqModalService);

    protected readonly store = inject(ShadowStore);
    protected readonly colors = KbqComponentColors;

    protected open(): void {
        this.modal.create({
            kbqTitle: 'Удалить правило корреляции?',
            kbqContent: 'Правило перестанет создавать инциденты. Уже созданные инциденты останутся в списке.',
            kbqSize: ModalSize.Small,
            kbqMask: this.store.mask(),
            kbqMaskClosable: true,
            kbqOkText: 'Удалить',
            kbqCancelText: 'Отмена',
            kbqOkClick: () => true
        });
    }
}
