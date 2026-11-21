import { SCENARIOS, visibleText } from './scenarios';

describe('scenarios', () => {
    it('has twelve scenarios with unique ids and non-empty titles', () => {
        expect(SCENARIOS).toHaveLength(12);
        expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(12);
        for (const s of SCENARIOS) expect(s.title.trim()).not.toBe('');
    });

    it('marks the keyboard scenarios as typing', () => {
        const typing = SCENARIOS.filter((s) => s.mode === 'type');

        expect(typing.map((s) => s.clipboard)).toEqual(['13-55', '9f9999']);
        expect(typing[0].autocorrect).toBe(true);
        expect(typing[1].autocorrect).toBeUndefined();
    });

    it('covers the spec strings verbatim', () => {
        expect(SCENARIOS.map((s) => s.clipboard)).toEqual([
            '14:30',
            '  14:30  ',
            '14-16',
            '1430',
            'встреча в 15:30',
            '12.05.2025',
            'https://example.com/74-169/',
            'abc123',
            '25:99',
            '14:30\n15:00',
            '13-55',
            '9f9999'
        ]);
    });

    it('selects a substring that exists in the clipboard', () => {
        for (const s of SCENARIOS) {
            const [from, to] = s.selectRange;
            expect(s.clipboard.slice(from, to).length).toBeGreaterThan(0);
        }

        // Строку из предложения вставляют целиком: выделение — вся строка.
        const sentence = SCENARIOS.find((s) => s.id === 'sentence')!;
        expect(sentence.clipboard.slice(...sentence.selectRange)).toBe(sentence.clipboard);
    });

    it('shows invisible characters', () => {
        expect(visibleText('  14:30  ')).toBe('␣␣14:30␣␣');
        expect(visibleText('14:30\n15:00')).toBe('14:30⏎15:00');
        expect(visibleText('a\tb')).toBe('a⇥b');
    });
});
