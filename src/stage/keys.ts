/**
 * Символы клавиш для оверлея кепок.
 *
 * Комбо приходит строкой (`cmd+c`), потому что так его пишут сценарии и так его
 * видно в тексте шага. Глифы — часть оформления, а не сценария: раскладка клавиш
 * на маке и подписи вроде `Tab` живут здесь.
 */

/** Модификаторы: на клавише написано глифом, а не словом. */
const MODIFIERS: Record<string, string> = {
    cmd: '⌘',
    shift: '⇧',
    alt: '⌥',
    ctrl: '⌃'
};

/** Клавиши, у которых подпись не совпадает с названием в верхнем регистре. */
const NAMED: Record<string, string> = {
    tab: 'Tab'
};

/** Кепки комбо: по одной на каждую часть, разделённую `+`. */
export function capsOf(combo: string): string[] {
    return combo
        .split('+')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => MODIFIERS[part] ?? NAMED[part] ?? part.toUpperCase());
}
