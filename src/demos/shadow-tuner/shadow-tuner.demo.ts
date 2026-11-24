import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';

import { ShadowStore } from './model/shadow-store';
import { CardsScene } from './preview/cards-scene';
import { EventsWorkspaceScene } from './preview/events-workspace-scene';
import { LevelsScene } from './preview/levels-scene';
import { ModalScene } from './preview/modal-scene';
import { SelectScene } from './preview/select-scene';
import { WorkspaceScene } from './preview/workspace-scene';
import { SettingsPanel } from './settings/settings-panel';

/**
 * Инструмент подбора теней: слева вертикальная форма, справа превью на настоящих поверхностях
 * Кубика — от плиток уровней до открытой панели селекта, контент-панели и модалки.
 *
 * Наборы для светлой и тёмной темы живут в адресной строке (`ShadowStore`): ссылка открывает ровно
 * те значения, которые в ней записаны, а каждая правка переписывает её через `replaceState`.
 * Готовые значения уходят инлайн-переменными на `body`, поэтому тюнинг доходит и до оверлеев.
 */
@Component({
    selector: 'shadow-tuner-demo',
    imports: [
        CardsScene,
        EventsWorkspaceScene,
        KbqScrollbarViewport,
        LevelsScene,
        ModalScene,
        SelectScene,
        SettingsPanel,
        WorkspaceScene
    ],
    template: `
        <div class="tuner" data-shadow-tuner>
            <app-settings-panel class="tuner__settings" />

            <main class="tuner__preview" kbqScrollbarViewport>
                <app-levels-scene />
                <app-cards-scene />
                <app-select-scene />
                <app-events-workspace-scene />
                <app-workspace-scene />
                <app-modal-scene />
            </main>
        </div>
    `,
    styleUrl: './shadow-tuner.demo.scss',
    // The store writes its variables to the body, so it has to be re-created with the demo, not with the app.
    providers: [ShadowStore],
    encapsulation: ViewEncapsulation.Emulated,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShadowTunerDemo {}
