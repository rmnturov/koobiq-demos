import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { KbqThemeService } from '@koobiq/components/core';

import {
    Backdrop,
    CompareView,
    DEFAULT_PANEL,
    Elevation,
    Geometry,
    Layer,
    LayerColor,
    PanelElevation,
    Scheme,
    SchemeShadows,
    ShadowColor,
    TunerState,
    baseElevation,
    baseShadows,
    shadowCss,
    shadowProperties,
    stockShadows
} from './shadow-model';
import { decodeSearch, encodeSearch } from './url-state';

/**
 * Состояние тюнинга: два набора — для светлой и тёмной темы — вид превью и переключатели сцен.
 * Адресная строка и есть хранилище: каждое изменение уходит в `history.replaceState`, открытие
 * ссылки возвращает ровно тот набор, который в ней записан.
 *
 * Готовый набор пишется инлайн-переменными на `body`: класс темы и оверлеи CDK (панель селекта,
 * модалка) живут там же, а переменные на контейнере превью до них не доходят.
 */
@Injectable()
export class ShadowStore {
    private readonly body = inject(DOCUMENT).body;
    private readonly browser = inject(DOCUMENT).defaultView;
    private readonly theme = inject(KbqThemeService);

    private readonly state = signal<TunerState>(decodeSearch(this.browser?.location.search ?? ''));

    readonly scheme = computed<Scheme>(() => (this.theme.colorScheme() === 'dark' ? 'dark' : 'light'));
    readonly shadows = computed(() => this.state().sets[this.scheme()]);
    readonly css = computed(() => shadowCss(this.shadows(), this.scheme()));

    readonly view = computed(() => this.state().view);
    readonly backdrop = computed(() => this.state().backdrop);
    readonly panel = computed(() => this.state().panel);
    readonly mask = computed(() => this.state().mask);

    /**
     * «Было» — это сток темы: правки не применяются, поэтому поля формы и переключатели сцен
     * блокируются, а не молча пишут в набор, которого на экране нет.
     */
    readonly locked = computed(() => this.state().view === 'before');

    constructor() {
        // «Было» снимает инлайн-переменные, и в силу вступают токены самой темы.
        effect(() => {
            const after = this.state().view === 'after';

            for (const [name, value] of shadowProperties(this.shadows(), this.scheme())) {
                if (after) {
                    this.body.style.setProperty(name, value);
                } else {
                    this.body.style.removeProperty(name);
                }
            }
        });

        effect(() => this.writeSearch(encodeSearch(this.state())));

        inject(DestroyRef).onDestroy(() => {
            for (const [name] of shadowProperties(this.shadows(), this.scheme())) {
                this.body.style.removeProperty(name);
            }
        });
    }

    setColor(layer: Layer, slot: ShadowColor): void {
        this.update((set) => (set.colors[layer] = slot));
    }

    setGeometry(elevation: Elevation, layer: Layer, param: Geometry, value: number): void {
        this.update((set) => (set.elevations[elevation][layer][param] = value));
    }

    setLayerColor(elevation: Elevation, layer: Layer, color: LayerColor): void {
        this.update((set) => (set.elevations[elevation][layer].color = color));
    }

    resetElevation(elevation: Elevation): void {
        this.update((set) => (set.elevations[elevation] = baseElevation(this.scheme(), elevation)));
    }

    resetScheme(): void {
        const stock = baseShadows(this.scheme());

        this.update((set) => {
            set.colors = stock.colors;
            set.elevations = stock.elevations;
        });
        // Уровень контент-панели — часть настройки: сброс возвращает его к стоку вида «Стало».
        this.patch((state) => (state.panel = DEFAULT_PANEL));
    }

    /** Сброс обеих тем: превью возвращается в «Стало», переключатели фона и маски остаются как были. */
    resetSchemes(): void {
        this.patch((state) => {
            state.sets = { light: baseShadows('light'), dark: baseShadows('dark') };
            state.view = 'after';
            state.panel = DEFAULT_PANEL;
        });
    }

    setView(view: CompareView): void {
        this.patch((state) => (state.view = view));
    }

    setBackdrop(backdrop: Backdrop): void {
        this.patch((state) => (state.backdrop = backdrop));
    }

    setPanel(panel: PanelElevation): void {
        this.patch((state) => (state.panel = panel));
    }

    setMask(mask: boolean): void {
        this.patch((state) => (state.mask = mask));
    }

    private update(change: (set: SchemeShadows) => void): void {
        const scheme = this.scheme();

        this.state.update((state) => {
            const set: SchemeShadows = structuredClone(state.sets[scheme]);

            change(set);

            // Правка видна только в «Стало»: иначе число меняется, а превью стоит на месте.
            return { ...state, view: 'after', sets: { ...state.sets, [scheme]: set } };
        });
    }

    private patch(change: (state: TunerState) => void): void {
        this.state.update((state) => {
            const next: TunerState = { ...state, sets: { ...state.sets } };

            change(next);

            return next;
        });
    }

    /**
     * Адрес меняется без записи в историю: правка числа не должна превращать кнопку «назад» в шаг
     * по настройкам. Строка сравнивается с текущей, чтобы `replaceState` не звался на каждый тик.
     */
    private writeSearch(search: string): void {
        const browser = this.browser;

        if (!browser || browser.location.search.slice(1) === search) return;

        const { pathname, hash } = browser.location;

        browser.history.replaceState(browser.history.state, '', `${pathname}${search ? `?${search}` : ''}${hash}`);
    }
}
