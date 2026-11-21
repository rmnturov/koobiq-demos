/**
 * Кадр сцены: широкий и узкий.
 *
 * Широкий кадр — дизайнерские 720×400. Внизу он вписывается в место настолько
 * мелким масштабом, что 14px текст сцены превращается в 6px, поэтому ниже 600px
 * места кадр складывается: сцена и так вертикальная колонка, и сообщение
 * оказывается над формой.
 *
 * Узкий кадр не сжимается: если места меньше 360px, он забирает всю ширину.
 * Иначе на 320px экране 360-й кадр рисовался бы в масштабе 0.76 и текст поля
 * снова стал бы нечитаемым. Ниже 600px места масштаб всегда 1.
 */

/** Размер кадра в дизайнерских пикселях и то, сложен ли он. */
export interface Frame {
    readonly width: number;
    readonly height: number;
    readonly narrow: boolean;
}

/** Ниже этой ширины места широкий кадр уже не читается. */
export const NARROW_BELOW = 600;

/** Узкий кадр: та же сцена колонкой, сообщение над формой. */
export const NARROW_WIDTH = 360;

/** Высота узкого кадра: в неё помещается сообщение и форма целиком. */
export const NARROW_HEIGHT = 500;

/**
 * Кадр под место: ниже порога — узкий, иначе широкий.
 *
 * `fill` растягивает широкий кадр на всё место: сцена живёт в своей серой полосе
 * и по ширине не обрывается. Без него кадр держится дизайнерской ширины и стоит
 * по центру. Нулевая ширина — ещё не раскладка, а не «места нет»: кадр остаётся
 * широким.
 */
export function frameFor(available: number, wide: { width: number; height: number }, fill = false): Frame {
    if (!(available > 0)) {
        return { width: wide.width, height: wide.height, narrow: false };
    }

    if (available >= NARROW_BELOW) {
        // Дробная ширина дала бы лишний субпиксель за краем места.
        const width = fill ? Math.max(wide.width, Math.floor(available)) : wide.width;

        return { width, height: wide.height, narrow: false };
    }

    return {
        // Дробная ширина дала бы лишний субпиксель за краем места.
        width: Math.min(NARROW_WIDTH, Math.max(1, Math.floor(available))),
        height: NARROW_HEIGHT,
        narrow: true
    };
}
