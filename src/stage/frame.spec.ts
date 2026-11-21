import { NARROW_BELOW, NARROW_HEIGHT, NARROW_WIDTH, frameFor } from './frame';

/** Широкий кадр такой, каким его задают входы сцены в демо. */
const wide = { width: 720, height: 480 };

describe('frameFor', () => {
    it('keeps the wide frame while the place is at least the breakpoint', () => {
        expect(frameFor(NARROW_BELOW, wide)).toEqual({ width: 720, height: 480, narrow: false });
        expect(frameFor(1000, wide)).toEqual({ width: 720, height: 480, narrow: false });
    });

    it('sticks to the wide frame until the layout has been measured', () => {
        // jsdom и первая раскладка: ноль — это «ещё не мерили», а не «места нет».
        expect(frameFor(0, wide)).toEqual({ width: 720, height: 480, narrow: false });
    });

    it('folds the frame into 360×500 just below the breakpoint', () => {
        expect(frameFor(NARROW_BELOW - 1, wide)).toEqual({
            width: NARROW_WIDTH,
            height: NARROW_HEIGHT,
            narrow: true
        });
        expect(frameFor(360, wide)).toEqual({ width: 360, height: 500, narrow: true });
    });

    it('gives the frame the whole place when it is narrower than 360, so text is not shrunk', () => {
        // 320px экран минус отступы демо: 360-й кадр дал бы масштаб 0.82 и 11px текста.
        expect(frameFor(296, wide)).toEqual({ width: 296, height: NARROW_HEIGHT, narrow: true });
        expect(frameFor(296.7, wide)).toEqual({ width: 296, height: NARROW_HEIGHT, narrow: true });
    });

    it('stretches the wide frame over the whole place when asked to fill', () => {
        // Серая полоса сцены не обрывается на 720: кадр идёт до края колонки.
        expect(frameFor(977, wide, true)).toEqual({ width: 977, height: 480, narrow: false });
        expect(frameFor(2096.7, wide, true)).toEqual({ width: 2096, height: 480, narrow: false });
    });

    it('never shrinks the wide frame below its design width when filling', () => {
        // Место уже дизайнерской ширины: кадр держит 720, дальше его жмёт масштаб.
        expect(frameFor(700, wide, true)).toEqual({ width: 720, height: 480, narrow: false });
    });

    it('keeps the narrow frame visible at degenerate widths', () => {
        expect(frameFor(0.5, wide).width).toBe(1);
    });
});
