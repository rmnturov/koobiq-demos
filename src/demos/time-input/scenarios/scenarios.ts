export type ScenarioMode = 'paste' | 'type';

export interface Scenario {
    id: string;
    title: string;
    clipboard: string;
    selectRange: readonly [number, number];
    /** 'paste' — строка приходит из буфера, 'type' — её печатают в поле. */
    mode?: ScenarioMode;
    /** Маска изменила набранное: показываем предупреждение contrast-тостом. */
    autocorrect?: boolean;
}

export const isTyping = (scenario: Scenario): boolean => scenario.mode === 'type';

export const SCENARIOS: readonly Scenario[] = [
    { id: 'clean', title: 'Чистое время', clipboard: '14:30', selectRange: [0, 5] },
    { id: 'spaces', title: 'Пробелы по краям', clipboard: '  14:30  ', selectRange: [0, 9] },
    { id: 'range', title: 'Похоже на диапазон', clipboard: '14-16', selectRange: [0, 5] },
    { id: 'digits', title: 'Четыре цифры', clipboard: '1430', selectRange: [0, 4] },
    {
        id: 'sentence',
        title: 'Время в предложении',
        clipboard: 'встреча в 15:30',
        /* Копируется и вставляется вся строка, поэтому выделена она целиком. */
        selectRange: [0, 15]
    },
    { id: 'date', title: 'Дата', clipboard: '12.05.2025', selectRange: [0, 10] },
    {
        id: 'url',
        title: 'Ссылка с числами',
        clipboard: 'https://example.com/74-169/',
        selectRange: [0, 26]
    },
    { id: 'junk', title: 'Буквы и цифры', clipboard: 'abc123', selectRange: [0, 6] },
    { id: 'invalid', title: 'Невалидное время', clipboard: '25:99', selectRange: [0, 5] },
    { id: 'multiline', title: 'Две строки', clipboard: '14:30\n15:00', selectRange: [0, 11] },
    {
        id: 'type-auto',
        title: 'Ввод с автозаменой',
        clipboard: '13-55',
        selectRange: [0, 5],
        mode: 'type',
        autocorrect: true
    },
    {
        id: 'type-junk',
        title: 'Ввод с ошибкой',
        clipboard: '9f9999',
        selectRange: [0, 6],
        mode: 'type'
    }
];

export function visibleText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n/g, '⏎')
        .replace(/\t/g, '⇥')
        .split('⏎')
        .map(markEdgeSpaces)
        .join('⏎');
}

/** Marks only edge spaces: inner spaces read as words, edge ones are invisible otherwise. */
function markEdgeSpaces(line: string): string {
    const match = /^( *)(.*?)( *)$/.exec(line);

    if (!match) {
        return line;
    }

    return `${'␣'.repeat(match[1].length)}${match[2]}${'␣'.repeat(match[3].length)}`;
}
