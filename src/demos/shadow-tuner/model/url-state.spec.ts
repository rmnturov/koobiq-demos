import { TunerState, defaultState } from './shadow-model';
import { decodeSearch, encodeSearch } from './url-state';

/** Стоковое состояние с правками: копия на каждый тест, чтобы правки не перетекали друг в друга. */
function tuned(change: (state: TunerState) => void): TunerState {
    const state = defaultState();

    change(state);

    return state;
}

describe('shadow url', () => {
    it('encodes the untouched state as an empty search and decodes it back', () => {
        expect(encodeSearch(defaultState())).toBe('');
        expect(decodeSearch('')).toEqual(defaultState());
    });

    it('writes the geometry of a layer as four numbers in one parameter', () => {
        const search = encodeSearch(tuned((state) => (state.sets.light.elevations.popup.key.blur = 20)));

        expect(search).toBe('light.popup.key=0,2,20,0');

        // Запятые остаются запятыми: `%2C` в ссылке читался бы как мусор.
        expect(search).not.toContain('%2C');

        const restored = decodeSearch(search).sets.light.elevations.popup.key;

        expect(restored.blur).toBe(20);
        expect([restored.x, restored.y, restored.spread]).toEqual([0, 2, 0]);
    });

    it('round-trips the named line colour', () => {
        const state = tuned((draft) => {
            draft.sets.light.colors.outline = 'line';
            draft.sets.light.elevations.popup.key.color = 'line';
        });
        const search = encodeSearch(state);

        expect(search).toContain('light.colors.outline=line');
        expect(search).toContain('light.popup.key.color=line');

        const light = decodeSearch(search).sets.light;

        expect(light.colors.outline).toBe('line');
        expect(light.elevations.popup.key.color).toBe('line');
    });

    it('keeps the shared layer colour apart from the colour of one layer', () => {
        const state = tuned((draft) => {
            draft.sets.light.colors.key = 'a8';
            draft.sets.light.elevations.overlay.key.color = 'a4';
        });
        const search = encodeSearch(state);

        expect(search).toContain('light.colors.key=a8');
        expect(search).toContain('light.overlay.key.color=a4');

        const light = decodeSearch(search).sets.light;

        expect(light.colors.key).toBe('a8');
        expect(light.elevations.overlay.key.color).toBe('a4');
        // Свой цвет уровня не подменяет общий цвет слоя: остальные уровни идут по токену.
        expect(light.elevations.popup.key.color).toBe('token');
        expect(light.colors.ambient).toBe('a1');
    });

    it('marks the dark set with its own scheme prefix', () => {
        const search = encodeSearch(tuned((state) => (state.sets.dark.elevations.card.key.blur = 12)));

        expect(search).toBe('dark.card.key=0,1,12,0');

        const decoded = decodeSearch(search);

        expect(decoded.sets.dark.elevations.card.key.blur).toBe(12);
        // Светлый набор при этом стоковый: темы в ссылке не смешиваются.
        expect(decoded.sets.light.elevations.card.key.blur).toBe(4);
    });

    it('writes the preview switches only where they differ from the default', () => {
        const defaults = encodeSearch(defaultState());

        expect(defaults).not.toContain('view=');
        expect(defaults).not.toContain('backdrop=');
        expect(defaults).not.toContain('panel=');
        expect(defaults).not.toContain('mask=');

        const search = encodeSearch(
            tuned((state) => {
                state.view = 'before';
                state.backdrop = 'bg-secondary';
                state.panel = 'popup';
                state.mask = false;
            })
        );
        const decoded = decodeSearch(search);

        expect(decoded.view).toBe('before');
        expect(decoded.backdrop).toBe('bg-secondary');
        expect(decoded.panel).toBe('popup');
        expect(decoded.mask).toBe(false);
    });

    it('falls back to the stock set on anything that does not fit the schema', () => {
        const searches = [
            'garbage',
            // Три числа вместо четырёх: пара на слой неполная.
            'light.card.key=1,2',
            // Не числа.
            'light.card.key=a,b,c,d',
            // Число вне диапазона: blur кончается на 96.
            'light.card.key=0,1,500,0',
            // Неизвестный параметр.
            'light.nowhere.key=1,2,3,4',
            // Слота `a99` в палитре нет.
            'light.colors.key=a99',
            'light.card.key.color=a99'
        ];

        for (const search of searches) {
            expect(decodeSearch(search)).toEqual(defaultState());
        }

        // Мусор рядом с валидной парой не отменяет её: разбор не падает и берёт то, что сошлось.
        const mixed = decodeSearch('light.card.key=0,1,500,0&light.popup.key=0,2,20,0');

        expect(mixed.sets.light.elevations.card.key.blur).toBe(4);
        expect(mixed.sets.light.elevations.popup.key.blur).toBe(20);
    });

    it('round-trips a state with several edits', () => {
        const state = tuned((draft) => {
            draft.sets.light.elevations.popup.key.blur = 20;
            draft.sets.light.elevations.overlay.ambient.color = 'a5';
            draft.sets.dark.colors.outline = 'a12';
            draft.sets.dark.elevations.card.key.spread = 0.5;
            draft.view = 'before';
            draft.backdrop = 'bg-secondary';
            draft.panel = 'overlay';
            draft.mask = false;
        });

        expect(decodeSearch(encodeSearch(state))).toEqual(state);
    });
});
