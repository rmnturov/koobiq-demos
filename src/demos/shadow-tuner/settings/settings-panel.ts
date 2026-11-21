import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { KbqButtonModule, KbqButtonStyles } from '@koobiq/components/button';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';
import { KbqCodeBlockFile, KbqCodeBlockModule } from '@koobiq/components/code-block';
import { KbqContentPanelContainer, KbqContentPanelModule } from '@koobiq/components/content-panel';
import { KbqComponentColors, PopUpPlacements } from '@koobiq/components/core';
import { KbqDropdownModule } from '@koobiq/components/dropdown';
import { KbqIconButton, KbqIconModule } from '@koobiq/components/icon';
import { KbqSplitButtonModule } from '@koobiq/components/split-button';
import { KbqToolTipModule } from '@koobiq/components/tooltip';

import { ELEVATIONS, Elevation, GEOMETRY, LAYERS, Layer, LayerColor } from '../model/shadow-model';
import { ELEVATION_LABELS, GEOMETRY_LABELS, LAYER_LABELS } from '../model/shadow-labels';
import { ShadowStore } from '../model/shadow-store';
import { PaletteSelect } from './palette-select';
import { ShadowNumberField } from './shadow-number-field';

/**
 * Панель стоит слева сама по себе, а не в `kbq-content-panel-container`: контейнер ставит панель
 * только справа. Шапке нужен контейнер ради кнопки закрытия — закрывать тут нечего, поэтому
 * заглушка с `disableClose`.
 */
const SETTINGS_PANEL_CONTAINER = {
    provide: KbqContentPanelContainer,
    useValue: { disableClose: () => true, close: () => undefined }
};

/** Сколько держится подтверждение копирования, мс. */
const COPIED_FEEDBACK_MS = 1500;

/**
 * Ссылка в буфер обмена: `navigator.clipboard` требует жеста и защищённого контекста, поэтому
 * запасной путь — скрытая `textarea` и `execCommand`. Подтверждение показывается только на `true`:
 * обе ветки умеют молча не сработать.
 */
async function copyText(browser: Window, text: string): Promise<boolean> {
    try {
        if (browser.navigator.clipboard?.writeText) {
            await browser.navigator.clipboard.writeText(text);

            return true;
        }
    } catch {
        // Права на буфер обмена не дали — ниже попытка через выделение.
    }

    const area = browser.document.createElement('textarea');

    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    browser.document.body.append(area);
    area.select();

    let copied = false;

    try {
        copied = browser.document.execCommand('copy');
    } catch {
        copied = false;
    }

    area.remove();

    return copied;
}

@Component({
    selector: 'app-settings-panel',
    imports: [
        KbqButtonModule,
        KbqButtonToggleModule,
        KbqCodeBlockModule,
        KbqContentPanelModule,
        KbqDropdownModule,
        KbqIconButton,
        KbqIconModule,
        KbqSplitButtonModule,
        KbqToolTipModule,
        PaletteSelect,
        ShadowNumberField
    ],
    providers: [SETTINGS_PANEL_CONTAINER],
    templateUrl: './settings-panel.html',
    styleUrl: './settings-panel.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPanel {
    protected readonly store = inject(ShadowStore);

    protected readonly elevations = ELEVATIONS;
    protected readonly layers = LAYERS;
    protected readonly geometry = GEOMETRY;
    protected readonly geometryLabels = GEOMETRY_LABELS;
    protected readonly layerLabels = LAYER_LABELS;
    protected readonly elevationLabels = ELEVATION_LABELS;
    protected readonly colors = KbqComponentColors;
    protected readonly buttonStyles = KbqButtonStyles;
    protected readonly placements = PopUpPlacements;
    protected readonly sharedColorsHint =
        'Цвета слоёв тени: токены --kbq-shadow-outline, --kbq-shadow-key и --kbq-shadow-ambient. ' +
        'Уровень берёт их, если в его слое не выбран свой оттенок.';
    /** Токен уровня ушёл из-под заголовка в подсказку: на экране остаётся только имя уровня. */
    protected readonly elevationHints: Record<Elevation, string> = {
        card: '--kbq-shadow-card — карточки и плитка.',
        popup: '--kbq-shadow-popup — выпадашки, меню и селекты.',
        overlay: '--kbq-shadow-overlay — модалки и контент-панели.'
    };

    /** Подтверждение копирования: ссылка ушла в буфер, кнопка на время меняет подпись. */
    protected readonly copied = signal(false);

    private readonly browser = inject(DOCUMENT).defaultView;
    private copiedTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        inject(DestroyRef).onDestroy(() => clearTimeout(this.copiedTimer));
    }

    // Блок CSS скрыт до решения по его виду: значение остаётся готовым вернуться в разметку.
    protected readonly files = computed<KbqCodeBlockFile[]>(() => [
        { content: this.store.css(), language: 'css', filename: `shadows-${this.store.scheme()}.css` }
    ]);

    /** У общего токена нет пункта «токен»: его значение — всегда слот палитры. */
    protected setSharedColor(layer: Layer, color: LayerColor): void {
        if (color !== 'token') this.store.setColor(layer, color);
    }

    /** Копируем адрес как есть: правки тюнера уже в нём. */
    protected async copyUrl(): Promise<void> {
        const browser = this.browser;

        if (!browser || !(await copyText(browser, browser.location.href))) return;

        this.copied.set(true);
        clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => this.copied.set(false), COPIED_FEEDBACK_MS);
    }
}
