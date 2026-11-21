import {
    Backdrop,
    CompareView,
    DEFAULT_PANEL,
    ELEVATIONS,
    Elevation,
    GEOMETRY,
    LAYERS,
    Layer,
    LayerColor,
    PanelElevation,
    Scheme,
    SchemeShadows,
    ShadowColor,
    TunerState,
    baseShadows,
    defaultState,
    restoreShadows
} from './shadow-model';

/**
 * Состояние тюнера в адресной строке. В URL попадает только то, что отличается от базового набора
 * темы: ссылка на готовый набор остаётся короткой, а её diff читается глазами.
 *
 * Имена параметров — `<тема>.<что>`: `light.colors.key`, `light.popup.key`, `light.popup.key.color`.
 * Геометрия слоя — одна пара параметров на четыре числа, в порядке `x,y,blur,spread`.
 */
const SCHEMES: readonly Scheme[] = ['light', 'dark'];
const VIEWS: readonly CompareView[] = ['before', 'after'];
const BACKDROPS: readonly Backdrop[] = ['bg', 'bg-secondary'];
const PANELS: readonly PanelElevation[] = ['none', ...ELEVATIONS];

export function encodeSearch(state: TunerState): string {
    const params = new URLSearchParams();

    for (const scheme of SCHEMES) {
        const stock = baseShadows(scheme);
        const set = state.sets[scheme];

        for (const layer of LAYERS) {
            if (set.colors[layer] !== stock.colors[layer]) {
                params.set(`${scheme}.colors.${layer}`, set.colors[layer]);
            }
        }

        for (const elevation of ELEVATIONS) {
            for (const layer of LAYERS) {
                const tuned = set.elevations[elevation][layer];
                const base = stock.elevations[elevation][layer];

                if (tuned.color !== base.color) {
                    params.set(`${scheme}.${elevation}.${layer}.color`, tuned.color);
                }

                if (GEOMETRY.some((param) => tuned[param] !== base[param])) {
                    params.set(`${scheme}.${elevation}.${layer}`, GEOMETRY.map((param) => tuned[param]).join(','));
                }
            }
        }
    }

    if (state.view !== 'after') params.set('view', state.view);
    if (state.backdrop !== 'bg') params.set('backdrop', state.backdrop);
    if (state.panel !== DEFAULT_PANEL) params.set('panel', state.panel);
    if (!state.mask) params.set('mask', 'false');

    // Запятые между числами `URLSearchParams` кодирует в `%2C`: в ссылке они читаются глазами, а
    // `decodeSearch` разбирает строку через тот же `URLSearchParams` и раскодирует их обратно.
    return params.toString().replaceAll('%2C', ',');
}

/** Всё, чего нет в строке или что не сходится со схемой, берётся базовым набором этой темы. */
export function decodeSearch(search: string): TunerState {
    const state = defaultState();
    const params = new URLSearchParams(search);

    for (const scheme of SCHEMES) {
        state.sets[scheme] = restoreShadows(readSet(params, scheme), scheme);
    }

    const view = params.get('view');
    const backdrop = params.get('backdrop');
    const panel = params.get('panel');
    const mask = params.get('mask');

    if (VIEWS.includes(view as CompareView)) state.view = view as CompareView;
    if (BACKDROPS.includes(backdrop as Backdrop)) state.backdrop = backdrop as Backdrop;
    if (PANELS.includes(panel as PanelElevation)) state.panel = panel as PanelElevation;
    if (mask === 'false') state.mask = false;

    return state;
}

/** Разобранные параметры одной темы в виде сырого набора: проверку диапазонов делает `restoreShadows`. */
function readSet(params: URLSearchParams, scheme: Scheme): unknown {
    const raw = baseShadows(scheme);

    for (const layer of LAYERS) {
        const color = params.get(`${scheme}.colors.${layer}`);

        if (color !== null) raw.colors[layer] = color as ShadowColor;
    }

    for (const elevation of ELEVATIONS) {
        for (const layer of LAYERS) {
            readGeometry(params, raw, scheme, elevation, layer);

            const color = params.get(`${scheme}.${elevation}.${layer}.color`);

            if (color !== null) raw.elevations[elevation][layer].color = color as LayerColor;
        }
    }

    return raw;
}

function readGeometry(
    params: URLSearchParams,
    raw: SchemeShadows,
    scheme: Scheme,
    elevation: Elevation,
    layer: Layer
): void {
    const geometry = params.get(`${scheme}.${elevation}.${layer}`);

    if (geometry === null) return;

    const values = geometry.split(',');

    if (values.length !== GEOMETRY.length) return;

    GEOMETRY.forEach((param, index) => {
        const text = values[index].trim();

        raw.elevations[elevation][layer][param] = text === '' ? NaN : Number(text);
    });
}
