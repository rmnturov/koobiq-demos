export type Elevation = 'card' | 'popup' | 'overlay';
export type Layer = 'outline' | 'key' | 'ambient';
export type Scheme = 'light' | 'dark';
export type Geometry = 'x' | 'y' | 'blur' | 'spread';

/** Слот палитры: сплошной `1`…`20`, с альфой `a1`…`a20` или прозрачный слой. */
export type PaletteSlot = `${number}` | `a${number}` | 'transparent';

/** Цвет слоя помимо палитры: `line` — `--kbq-line-contrast-less`, обводка примера на карточке. */
export type NamedColor = 'line';

export type ShadowColor = PaletteSlot | NamedColor;

/** Цвет слоя уровня: общий токен слоя (`--kbq-shadow-key` и т. п.) или свой слот палитры. */
export type LayerColor = 'token' | ShadowColor;

export type LayerGeometry = Record<Geometry, number>;
export type ElevationLayer = LayerGeometry & { color: LayerColor };
export type ElevationGeometry = Record<Layer, ElevationLayer>;

export interface SchemeShadows {
    /** Цвет слоя общий для всех уровней: это токены `--kbq-shadow-outline/key/ambient`. */
    colors: Record<Layer, ShadowColor>;
    elevations: Record<Elevation, ElevationGeometry>;
}

export const ELEVATIONS: readonly Elevation[] = ['card', 'popup', 'overlay'];
export const LAYERS: readonly Layer[] = ['outline', 'key', 'ambient'];
export const GEOMETRY: readonly Geometry[] = ['x', 'y', 'blur', 'spread'];

export const GEOMETRY_RANGE: Record<Geometry, { min: number; max: number }> = {
    x: { min: -32, max: 32 },
    y: { min: -32, max: 32 },
    blur: { min: 0, max: 96 },
    spread: { min: -32, max: 32 }
};

/** Шаг значения: spread бывает полупиксельным, остальное — целые пиксели. */
export const GEOMETRY_STEP: Record<Geometry, number> = { x: 1, y: 1, blur: 1, spread: 0.5 };

export const SOLID_SLOTS: readonly PaletteSlot[] = Array.from({ length: 20 }, (_, i) => `${i + 1}` as PaletteSlot);
export const ALPHA_SLOTS: readonly PaletteSlot[] = Array.from({ length: 20 }, (_, i) => `a${i + 1}` as PaletteSlot);

const geometry = (x: number, y: number, blur: number, spread: number): ElevationLayer => ({
    x,
    y,
    blur,
    spread,
    color: 'token'
});

/** Стоковая геометрия: `design-tokens/web/css/light/shadows.css`. В тёмной теме она та же. */
const STOCK_ELEVATIONS: Record<Elevation, ElevationGeometry> = {
    card: { outline: geometry(0, 0, 0, 1), key: geometry(0, 1, 6, 0), ambient: geometry(0, 1, 6, 0) },
    popup: { outline: geometry(0, 0, 0, 1), key: geometry(0, 2, 8, 0), ambient: geometry(0, 3, 8, 0) },
    overlay: { outline: geometry(0, 0, 0, 1), key: geometry(0, 3, 16, 0), ambient: geometry(0, 4, 32, 0) }
};

/** Стоковые цвета слоёв: `light/semantic-colors.css:154-156`, `dark/semantic-colors.css:7,8,156`. */
const STOCK_COLORS: Record<Scheme, Record<Layer, PaletteSlot>> = {
    light: { outline: 'a1', key: 'a3', ambient: 'a2' },
    dark: { outline: 'a6', key: 'transparent', ambient: 'transparent' }
};

export function stockElevation(elevation: Elevation): ElevationGeometry {
    return structuredClone(STOCK_ELEVATIONS[elevation]);
}

export function stockShadows(scheme: Scheme): SchemeShadows {
    return { colors: { ...STOCK_COLORS[scheme] }, elevations: structuredClone(STOCK_ELEVATIONS) };
}

/**
 * Пресет светлой темы — с него начинается «Стало» и куда возвращают сбросы. Ключевой и фоновый слои
 * взяты цветом обводки, обводки уровней тоньше стока: так пример показывает подгонку теней, а не сток.
 */
const LIGHT_PRESET_COLORS: Partial<Record<Layer, ShadowColor>> = { key: 'a1', ambient: 'a1' };
const LIGHT_PRESET_GEOMETRY: Partial<Record<Elevation, Partial<Record<Layer, LayerGeometry>>>> = {
    card: { key: { x: 0, y: 1, blur: 4, spread: 0 } },
    popup: { outline: { x: 0, y: 0, blur: 0, spread: 0.5 } },
    overlay: { outline: { x: 0, y: 0, blur: 0, spread: 0.5 } }
};

/** Набор, с которым открывается демо и который возвращает сброс. «Было» всё равно показывает сток. */
export function baseShadows(scheme: Scheme): SchemeShadows {
    const set = stockShadows(scheme);

    if (scheme !== 'light') return set;

    for (const layer of LAYERS) {
        const color = LIGHT_PRESET_COLORS[layer];

        if (color) set.colors[layer] = color;
    }

    for (const elevation of ELEVATIONS) {
        for (const layer of LAYERS) {
            const preset = LIGHT_PRESET_GEOMETRY[elevation]?.[layer];

            if (preset) set.elevations[elevation][layer] = { ...preset, color: 'token' };
        }
    }

    return set;
}

export function baseElevation(scheme: Scheme, elevation: Elevation): ElevationGeometry {
    return structuredClone(baseShadows(scheme).elevations[elevation]);
}

/**
 * Переменная цвета для слоя в теме: `line` — токен линии, остальное — палитра
 * (`semantic-contrast` в светлой, `semantic-dark-contrast` в тёмной).
 */
export function paletteVar(slot: ShadowColor, scheme: Scheme): string {
    if (slot === 'transparent') return 'transparent';
    if (slot === 'line') return 'var(--kbq-line-contrast-less)';

    const family = scheme === 'light' ? 'semantic-contrast' : 'semantic-dark-contrast';

    return `var(--kbq-${family}-${slot})`;
}

export function layerVar(layer: Layer): string {
    return `--kbq-shadow-${layer}`;
}

export function elevationVar(elevation: Elevation): string {
    return `--kbq-shadow-${elevation}`;
}

/** Цвет слоя в значении уровня: общий токен или переменная палитры. */
export function layerColorValue(layer: Layer, color: LayerColor, scheme: Scheme): string {
    return color === 'token' ? `var(${layerVar(layer)})` : paletteVar(color, scheme);
}

/** Значение `--kbq-shadow-<elevation>`: слои через запятую в порядке outline, key, ambient. */
export function elevationValue(value: ElevationGeometry, scheme: Scheme): string {
    return LAYERS.map((layer) => {
        const { x, y, blur, spread, color } = value[layer];

        return `${x}px ${y}px ${blur}px ${spread}px ${layerColorValue(layer, color, scheme)}`;
    }).join(', ');
}

/** Все шесть переменных набора: три цвета слоёв и три уровня. */
export function shadowProperties(shadows: SchemeShadows, scheme: Scheme): Array<[string, string]> {
    return [
        ...LAYERS.map((layer): [string, string] => [layerVar(layer), paletteVar(shadows.colors[layer], scheme)]),
        ...ELEVATIONS.map((elevation): [string, string] => [
            elevationVar(elevation),
            elevationValue(shadows.elevations[elevation], scheme)
        ])
    ];
}

/** CSS набора для копирования в токены. */
export function shadowCss(shadows: SchemeShadows, scheme: Scheme): string {
    const lines = shadowProperties(shadows, scheme).map(([name, value]) => `    ${name}: ${value};`);

    return `.kbq-${scheme} {\n${lines.join('\n')}\n}`;
}

/** Значение поля годится в токен: кратно шагу параметра и в диапазоне. Пустое поле (`null`) — нет. */
export function isValidGeometry(value: number | null | undefined, param: Geometry): value is number {
    if (value === null || value === undefined || !Number.isInteger(value / GEOMETRY_STEP[param])) return false;

    const { min, max } = GEOMETRY_RANGE[param];

    return value >= min && value <= max;
}

/** «Было» — стоковые токены темы, «Стало» — набор из формы. */
export type CompareView = 'before' | 'after';

/** Фон под плитками уровней. */
export type Backdrop = 'bg' | 'bg-secondary';

/** Какой уровень тени примеряет контент-панель: `none` — её штатная обводка. */
export type PanelElevation = 'none' | Elevation;

/** Уровень, который панель носит в «Стало», пока его не переключили. В ссылке он не пишется. */
export const DEFAULT_PANEL: PanelElevation = 'overlay';

export interface TunerState {
    sets: Record<Scheme, SchemeShadows>;
    view: CompareView;
    backdrop: Backdrop;
    panel: PanelElevation;
    mask: boolean;
}

/** Состояние без единой правки: оба набора базовые (в светлой — пресет), превью показывает «Стало». */
export function defaultState(): TunerState {
    return {
        sets: { light: baseShadows('light'), dark: baseShadows('dark') },
        view: 'after',
        backdrop: 'bg',
        panel: DEFAULT_PANEL,
        mask: true
    };
}

export function isPaletteSlot(value: unknown): value is PaletteSlot {
    return typeof value === 'string' && /^(a?([1-9]|1\d|20)|transparent)$/.test(value);
}

/** Слот палитры или именованный цвет: из хранилища принимаем и `line`. */
export function isShadowColor(value: unknown): value is ShadowColor {
    return value === 'line' || isPaletteSlot(value);
}

/** Набор из хранилища: всё, что не сходится со схемой, заменяется базовым набором этой темы. */
export function restoreShadows(raw: unknown, scheme: Scheme): SchemeShadows {
    const stock = baseShadows(scheme);
    const source = raw as Partial<SchemeShadows> | null | undefined;

    for (const layer of LAYERS) {
        const slot = source?.colors?.[layer];

        if (isShadowColor(slot)) stock.colors[layer] = slot;
    }

    for (const elevation of ELEVATIONS) {
        for (const layer of LAYERS) {
            for (const param of GEOMETRY) {
                const value = source?.elevations?.[elevation]?.[layer]?.[param];

                if (isValidGeometry(value, param)) stock.elevations[elevation][layer][param] = value;
            }

            const color = source?.elevations?.[elevation]?.[layer]?.color;

            if (color === 'token' || isShadowColor(color)) stock.elevations[elevation][layer].color = color;
        }
    }

    return stock;
}
