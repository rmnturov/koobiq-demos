import {
    baseShadows,
    elevationValue,
    isValidGeometry,
    paletteVar,
    restoreShadows,
    shadowCss,
    shadowProperties,
    stockShadows
} from './shadow-model';

describe('shadow model', () => {
    it('reproduces the stock light tokens', () => {
        const props = Object.fromEntries(shadowProperties(stockShadows('light'), 'light'));

        expect(props['--kbq-shadow-outline']).toBe('var(--kbq-semantic-contrast-a1)');
        expect(props['--kbq-shadow-key']).toBe('var(--kbq-semantic-contrast-a3)');
        expect(props['--kbq-shadow-ambient']).toBe('var(--kbq-semantic-contrast-a2)');
        expect(props['--kbq-shadow-popup']).toBe(
            '0px 0px 0px 1px var(--kbq-shadow-outline), 0px 2px 8px 0px var(--kbq-shadow-key), ' +
                '0px 3px 8px 0px var(--kbq-shadow-ambient)'
        );
    });

    it('takes the dark palette and transparent layers in the dark scheme', () => {
        const props = Object.fromEntries(shadowProperties(stockShadows('dark'), 'dark'));

        expect(props['--kbq-shadow-outline']).toBe('var(--kbq-semantic-dark-contrast-a6)');
        expect(props['--kbq-shadow-key']).toBe('transparent');
        expect(paletteVar('12', 'dark')).toBe('var(--kbq-semantic-dark-contrast-12)');
    });

    it('paints the named line colour with the koobiq line token in both schemes', () => {
        const light = stockShadows('light');
        const dark = stockShadows('dark');

        light.colors.key = 'line';
        dark.elevations.card.outline.color = 'line';

        expect(Object.fromEntries(shadowProperties(light, 'light'))['--kbq-shadow-key']).toBe(
            'var(--kbq-line-contrast-less)'
        );
        expect(paletteVar('line', 'dark')).toBe('var(--kbq-line-contrast-less)');
        expect(elevationValue(dark.elevations.card, 'dark')).toContain('var(--kbq-line-contrast-less)');
    });

    it('opens the light theme on the preset the clean address stands for', () => {
        const base = baseShadows('light');

        expect(base.colors.outline).toBe('a1');
        expect(base.colors.key).toBe('a2');
        expect(base.colors.ambient).toBe('a1');
        expect(base.elevations.card.key).toEqual({ x: 0, y: 1, blur: 4, spread: 0, color: 'token' });
        expect(base.elevations.popup.outline.spread).toBe(0.5);
        expect(base.elevations.overlay.outline.spread).toBe(0.5);
        // Тёмная тема пресета не получает: у неё свой сток.
        expect(baseShadows('dark')).toEqual(stockShadows('dark'));
    });

    it('keeps elevations independent copies', () => {
        const set = stockShadows('light');

        set.elevations.card.key.blur = 40;

        expect(elevationValue(set.elevations.popup, 'light')).toContain('0px 2px 8px 0px var(--kbq-shadow-key)');
        expect(stockShadows('light').elevations.card.key.blur).toBe(6);
    });

    it('paints a layer of one level with its own slot instead of the shared token', () => {
        const set = stockShadows('light');

        set.elevations.overlay.key.color = 'a8';

        const props = Object.fromEntries(shadowProperties(set, 'light'));

        expect(props['--kbq-shadow-overlay']).toContain('0px 3px 16px 0px var(--kbq-semantic-contrast-a8)');
        expect(props['--kbq-shadow-overlay']).toContain('var(--kbq-shadow-ambient)');
        expect(props['--kbq-shadow-card']).toContain('var(--kbq-shadow-key)');
    });

    it('wraps the CSS in the scheme class', () => {
        expect(shadowCss(stockShadows('dark'), 'dark')).toMatch(/^\.kbq-dark \{\n {4}--kbq-shadow-outline: /);
    });

    it('accepts only integers within the range', () => {
        expect(isValidGeometry(12, 'blur')).toBe(true);
        expect(isValidGeometry(-4, 'y')).toBe(true);
        expect(isValidGeometry(-1, 'blur')).toBe(false);
        expect(isValidGeometry(97, 'blur')).toBe(false);
        expect(isValidGeometry(4.5, 'x')).toBe(false);
        expect(isValidGeometry(0.5, 'spread')).toBe(true);
        expect(isValidGeometry(-1.5, 'spread')).toBe(true);
        expect(isValidGeometry(0.25, 'spread')).toBe(false);
        expect(isValidGeometry(null, 'x')).toBe(false);
    });

    it('restores stored sets and drops what does not fit the schema', () => {
        const stored = JSON.parse(JSON.stringify(stockShadows('light')));

        stored.colors.key = 'a12';
        stored.colors.ambient = 'a99';
        stored.elevations.popup.key.blur = 20;
        stored.elevations.popup.key.y = 500;
        stored.elevations.popup.ambient.color = 'a4';
        stored.elevations.card.ambient.color = 'blue';

        const restored = restoreShadows(stored, 'light');

        expect(restored.colors.key).toBe('a12');
        expect(restored.colors.ambient).toBe('a1');
        expect(restored.elevations.popup.key.blur).toBe(20);
        expect(restored.elevations.popup.key.y).toBe(2);
        expect(restored.elevations.popup.ambient.color).toBe('a4');
        expect(restored.elevations.card.ambient.color).toBe('token');
        expect(restoreShadows('garbage', 'dark')).toEqual(stockShadows('dark'));
    });
});
