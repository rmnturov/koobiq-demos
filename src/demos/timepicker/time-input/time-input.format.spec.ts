import {
    FORMAT_LABELS,
    TIME_FORMATS,
    errorText,
    formatTime,
    formValue,
    hasMilliseconds,
    hasSeconds,
    maskPlaceholder,
    sampleValue,
    segmentsOf
} from './time-input.format';

describe('time input formatting', () => {
    it.each([
        ['HH:mm', 'h23', 'ЧЧ:ММ'],
        ['HH:mm', 'h12', 'ЧЧ:ММ AM'],
        ['HH:mm:ss', 'h23', 'ЧЧ:ММ:СС'],
        ['HH:mm:ss.SSS', 'h12', 'ЧЧ:ММ:СС.ССС AM']
    ] as const)('mask of %s / %s is %s', (format, cycle, mask) => {
        expect(maskPlaceholder(format, cycle)).toBe(mask);
    });

    it.each([
        [
            { hours: 14, minutes: 30, seconds: 15, milliseconds: 250 },
            'HH:mm',
            'h23',
            '14:30'
        ],
        [
            { hours: 14, minutes: 30, seconds: 15, milliseconds: 250 },
            'HH:mm:ss',
            'h23',
            '14:30:15'
        ],
        [
            { hours: 14, minutes: 30, seconds: 15, milliseconds: 250 },
            'HH:mm:ss.SSS',
            'h23',
            '14:30:15.250'
        ],
        [
            { hours: 0, minutes: 5, seconds: 0, milliseconds: 5 },
            'HH:mm:ss.SSS',
            'h12',
            '12:05:00.005 AM'
        ],
        [{ hours: 13, minutes: 5, seconds: 0, milliseconds: 0 }, 'HH:mm', 'h12', '01:05 PM'],
        [{ hours: 12, minutes: 0, seconds: 0, milliseconds: 0 }, 'HH:mm', 'h12', '12:00 PM']
    ] as const)('renders %j as %s / %s', (value, format, cycle, text) => {
        expect(formatTime(value, format, cycle)).toBe(text);
    });

    it.each([
        ['HH:mm', '14:30'],
        ['HH:mm:ss', '14:30:15'],
        ['HH:mm:ss.SSS', '14:30:15.250']
    ] as const)('form value in %s is 24-hour', (format, text) => {
        expect(formValue({ hours: 14, minutes: 30, seconds: 15, milliseconds: 250 }, format)).toBe(
            text
        );
    });

    it.each([
        ['HH:mm', 'h23', 'Введите время в формате ЧЧ:ММ, например 14:30'],
        ['HH:mm:ss', 'h23', 'Введите время в формате ЧЧ:ММ:СС, например 14:30:15'],
        [
            'HH:mm:ss.SSS',
            'h23',
            'Введите время в формате ЧЧ:ММ:СС.ССС, например 14:30:15.250'
        ],
        ['HH:mm', 'h12', 'Введите время в формате ЧЧ:ММ AM, например 02:30 PM'],
        [
            'HH:mm:ss.SSS',
            'h12',
            'Введите время в формате ЧЧ:ММ:СС.ССС AM, например 02:30:15.250 PM'
        ]
    ] as const)('error text names the %s mask', (format, cycle, text) => {
        expect(errorText(format, cycle)).toBe(text);
    });

    it('lists the segments of a format', () => {
        expect(segmentsOf('HH:mm', 'h23')).toEqual(['hours', 'minutes']);
        expect(segmentsOf('HH:mm:ss', 'h23')).toEqual(['hours', 'minutes', 'seconds']);
        expect(segmentsOf('HH:mm:ss.SSS', 'h12')).toEqual([
            'hours',
            'minutes',
            'seconds',
            'milliseconds',
            'meridiem'
        ]);
    });

    it('knows which precisions carry seconds and milliseconds', () => {
        expect(hasSeconds('HH:mm')).toBe(false);
        expect(hasSeconds('HH:mm:ss')).toBe(true);
        expect(hasSeconds('HH:mm:ss.SSS')).toBe(true);

        expect(hasMilliseconds('HH:mm')).toBe(false);
        expect(hasMilliseconds('HH:mm:ss')).toBe(false);
        expect(hasMilliseconds('HH:mm:ss.SSS')).toBe(true);
    });

    it('offers the three precisions in order, each with a label', () => {
        expect(TIME_FORMATS).toEqual(['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS']);
        expect(TIME_FORMATS.map((format) => FORMAT_LABELS[format])).toEqual([
            'ЧЧ:ММ',
            'ЧЧ:ММ:СС',
            'ЧЧ:ММ:СС.ССС'
        ]);
    });

    it.each([
        ['HH:mm', 'h23', '14:30'],
        ['HH:mm:ss', 'h23', '14:30:15'],
        ['HH:mm:ss.SSS', 'h23', '14:30:15.250'],
        ['HH:mm', 'h12', '02:30 PM'],
        ['HH:mm:ss', 'h12', '02:30:15 PM'],
        ['HH:mm:ss.SSS', 'h12', '02:30:15.250 PM']
    ] as const)('sample of %s / %s is %s', (format, cycle, text) => {
        expect(sampleValue(format, cycle)).toBe(text);
    });
});
