import { HourCycle, Meridiem, Segment, TimeFormat, TimeValue } from './time-input.types';

/** Точности в порядке переключателя: от минут к миллисекундам. */
export const TIME_FORMATS: readonly TimeFormat[] = ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS'];

/** Подписи точности для переключателя и текста ошибки. */
export const FORMAT_LABELS: Record<TimeFormat, string> = {
    'HH:mm': 'ЧЧ:ММ',
    'HH:mm:ss': 'ЧЧ:ММ:СС',
    'HH:mm:ss.SSS': 'ЧЧ:ММ:СС.ССС'
};

/** Пример, которым подсказка и ошибка объясняют формат: половина третьего. */
const SAMPLE_TIME: TimeValue = { hours: 14, minutes: 30, seconds: 15, milliseconds: 250 };

function pad(value: number, size: number): string {
    return String(value).padStart(size, '0');
}

/** Есть ли в точности секунды. */
export function hasSeconds(format: TimeFormat): boolean {
    return format !== 'HH:mm';
}

/** Есть ли в точности миллисекунды. */
export function hasMilliseconds(format: TimeFormat): boolean {
    return format === 'HH:mm:ss.SSS';
}

/** Пустая маска поля: `ЧЧ:ММ`, `ЧЧ:ММ:СС`, `ЧЧ:ММ:СС.ССС` и ` AM` в 12-часовом цикле. */
export function maskPlaceholder(format: TimeFormat, cycle: HourCycle): string {
    const mask =
        'ЧЧ:ММ' + (hasSeconds(format) ? ':СС' : '') + (hasMilliseconds(format) ? '.ССС' : '');

    return cycle === 'h12' ? `${mask} AM` : mask;
}

/** Текст поля в текущем цикле: `14:30` в 24-часовом, `02:30 PM` — в 12-часовом. */
export function formatTime(value: TimeValue, format: TimeFormat, cycle: HourCycle): string {
    const hours = cycle === 'h12' ? value.hours % 12 || 12 : value.hours;
    let text = `${pad(hours, 2)}:${pad(value.minutes, 2)}`;

    if (hasSeconds(format)) {
        text += `:${pad(value.seconds, 2)}`;
    }

    if (hasMilliseconds(format)) {
        text += `.${pad(value.milliseconds, 3)}`;
    }

    if (cycle === 'h12') {
        text += ` ${meridiemOf(value.hours)}`;
    }

    return text;
}

/** Значение для формы: всегда 24-часовой канонический вид текущей точности. */
export function formValue(value: TimeValue, format: TimeFormat): string {
    return formatTime(value, format, 'h23');
}

/** Пример текущего формата для подсказки и текста ошибки. */
export function sampleValue(format: TimeFormat, cycle: HourCycle): string {
    return formatTime(SAMPLE_TIME, format, cycle);
}

/** Текст ошибки разбора: маска текущего формата и пример. */
export function errorText(format: TimeFormat, cycle: HourCycle): string {
    const mask = cycle === 'h12' ? `${FORMAT_LABELS[format]} AM` : FORMAT_LABELS[format];

    return `Введите время в формате ${mask}, например ${sampleValue(format, cycle)}`;
}

/** Сегменты формата по порядку; меридием — только в 12-часовом цикле. */
export function segmentsOf(format: TimeFormat, cycle: HourCycle): Segment[] {
    const segments: Segment[] = ['hours', 'minutes'];

    if (hasSeconds(format)) {
        segments.push('seconds');
    }

    if (hasMilliseconds(format)) {
        segments.push('milliseconds');
    }

    if (cycle === 'h12') {
        segments.push('meridiem');
    }

    return segments;
}

function meridiemOf(hours: number): Meridiem {
    return hours < 12 ? 'AM' : 'PM';
}
