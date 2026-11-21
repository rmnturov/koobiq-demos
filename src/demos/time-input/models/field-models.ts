export type ModelId = 'mask' | 'as-is' | 'smart';

export interface FieldState {
    value: string;
    error: string | null;
    /** Пояснение под полем. */
    hint: string | null;
    /** Значение, собранное моделью из другого текста: показывается тултипом над полем. */
    recognized?: string | null;
}

export interface FieldModel {
    id: ModelId;
    name: string;
    tagline: string;
    onPaste(text: string, prev: FieldState): FieldState;
    onBlur(prev: FieldState): FieldState;
}

export const EMPTY_STATE: FieldState = { value: '', error: null, hint: null };

export const TIME_ERROR = 'Введите время в формате ЧЧ:ММ, например 14:30';

const CANONICAL_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SEPARATED_RE = /^(\d{1,2})[:.\-](\d{2})$/;
const FOUR_DIGITS_RE = /^(\d{2})(\d{2})$/;
const AS_IS_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const IN_TEXT_RE = /(?<![\d/@.\-])(\d{1,2})[:.\-](\d{2})(?![\d/@.\-])/g;

const canonical = (hours: string, minutes: string): string =>
    `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;

const inRange = (hours: string, minutes: string): boolean =>
    Number(hours) <= 23 && Number(minutes) <= 59;

const digitsOnly = (text: string): string => text.replace(/\D/g, '').slice(0, 4);

const maskValue = (digits: string): string => {
    if (digits.length <= 2) {
        return digits;
    }

    return `${digits.slice(0, 2)}:${digits.slice(2).padStart(2, '0')}`;
};

const error = (prev: FieldState): FieldState => ({ ...prev, error: TIME_ERROR, hint: null });
const valid = (prev: FieldState): FieldState => ({ ...prev, error: null });

/**
 * Состояние поля, в которое печатают: маска берёт только цифры и достраивает
 * двоеточие, а ошибка появляется лишь когда цифр уже четыре.
 */
export function typingState(raw: string): FieldState {
    const digits = digitsOnly(raw);
    const value = maskValue(digits);

    if (digits.length < 4) {
        return { value, error: null, hint: null };
    }

    return {
        value,
        error: inRange(value.slice(0, 2), value.slice(3)) ? null : TIME_ERROR,
        hint: null
    };
}

const mask: FieldModel = {
    id: 'mask',
    name: 'Маска',
    tagline: 'Цифры складываются в ЧЧ:ММ, остальное исчезает',
    onPaste: (text) => ({ value: maskValue(digitsOnly(text)), error: null, hint: null }),
    onBlur: (prev) => {
        if (prev.value === '') {
            return valid(prev);
        }

        return CANONICAL_RE.test(prev.value) ? valid(prev) : error(prev);
    }
};

const asIs: FieldModel = {
    id: 'as-is',
    name: 'Как есть',
    tagline: 'Текст не меняется, ошибка ждет ухода из поля',
    onPaste: (text) => ({ value: text.replace(/[\r\n]+/g, ''), error: null, hint: null }),
    onBlur: (prev) => {
        if (prev.value === '') {
            return valid(prev);
        }

        return AS_IS_RE.test(prev.value) ? valid(prev) : error({ ...prev, hint: null });
    }
};

const matchTime = (value: string): { hours: string; minutes: string } | null => {
    const four = FOUR_DIGITS_RE.exec(value);

    if (four) {
        return { hours: four[1], minutes: four[2] };
    }

    const separated = SEPARATED_RE.exec(value);

    if (separated) {
        return { hours: separated[1], minutes: separated[2] };
    }

    const matches = [...value.matchAll(IN_TEXT_RE)];

    if (matches.length === 1) {
        return { hours: matches[0][1], minutes: matches[0][2] };
    }

    return null;
};

const smart: FieldModel = {
    id: 'smart',
    name: 'Умная вставка',
    tagline: 'Однозначное время распознается, остальное — ошибка',
    onPaste: (text) => ({
        // Несколько строк не отбрасываются и не выбираются за пользователя:
        // строки склеиваются в одну, а что из этого вышло — скажет проверка по blur.
        value: text.trim().replace(/\s+/g, ' '),
        error: null,
        hint: null
    }),
    onBlur: (prev) => {
        if (prev.value === '') {
            return valid(prev);
        }

        const match = matchTime(prev.value);

        if (!match || !inRange(match.hours, match.minutes)) {
            return error(prev);
        }

        const value = canonical(match.hours, match.minutes);

        return { value, error: null, hint: null, recognized: value === prev.value ? null : value };
    }
};

export const MODELS: readonly FieldModel[] = [mask, asIs, smart];

export function modelById(id: ModelId): FieldModel {
    const model = MODELS.find((item) => item.id === id);

    if (!model) {
        throw new Error(`unknown model: ${id}`);
    }

    return model;
}
