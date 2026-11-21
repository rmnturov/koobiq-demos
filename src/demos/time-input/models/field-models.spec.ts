import { FieldModel, FieldState, ModelId, modelById, TIME_ERROR } from './field-models';

const stage = (model: FieldModel, text: string): FieldState =>
    model.onBlur(model.onPaste(text, { value: '', error: null, hint: null }));
const row = (state: FieldState) => [state.value, state.error, state.hint];

describe('field models: paste then blur', () => {
    it.each([
        ['14:30', 'mask', '14:30', null, null],
        ['  14:30  ', 'mask', '14:30', null, null],
        ['14-16', 'mask', '14:16', null, null],
        ['1430', 'mask', '14:30', null, null],
        ['встреча в 15:30', 'mask', '15:30', null, null],
        ['12.05.2025', 'mask', '12:05', null, null],
        ['https://example.com/74-169/', 'mask', '74:16', TIME_ERROR, null],
        ['abc123', 'mask', '12:03', null, null],
        ['25:99', 'mask', '25:99', TIME_ERROR, null],
        ['14:30\n15:00', 'mask', '14:30', null, null],
        ['14:30', 'as-is', '14:30', null, null],
        ['  14:30  ', 'as-is', '  14:30  ', TIME_ERROR, null],
        ['14-16', 'as-is', '14-16', TIME_ERROR, null],
        ['1430', 'as-is', '1430', TIME_ERROR, null],
        ['встреча в 15:30', 'as-is', 'встреча в 15:30', TIME_ERROR, null],
        ['12.05.2025', 'as-is', '12.05.2025', TIME_ERROR, null],
        ['https://example.com/74-169/', 'as-is', 'https://example.com/74-169/', TIME_ERROR, null],
        ['abc123', 'as-is', 'abc123', TIME_ERROR, null],
        ['25:99', 'as-is', '25:99', TIME_ERROR, null],
        ['14:30\n15:00', 'as-is', '14:3015:00', TIME_ERROR, null],
        ['14:30', 'smart', '14:30', null, null],
        ['  14:30  ', 'smart', '14:30', null, null],
        ['14-16', 'smart', '14:16', null, null],
        ['1430', 'smart', '14:30', null, null],
        ['встреча в 15:30', 'smart', '15:30', null, null],
        ['12.05.2025', 'smart', '12.05.2025', TIME_ERROR, null],
        ['https://example.com/74-169/', 'smart', 'https://example.com/74-169/', TIME_ERROR, null],
        ['abc123', 'smart', 'abc123', TIME_ERROR, null],
        ['25:99', 'smart', '25:99', TIME_ERROR, null],
        ['14:30\n15:00', 'smart', '14:30 15:00', TIME_ERROR, null]
    ])('«%s» в модели %s', (text, id, value, error, hint) => {
        expect(row(stage(modelById(id as ModelId), text))).toEqual([value, error, hint]);
    });
});

describe('field model edges', () => {
    it('умная модель отдаёт распознанное значение отдельным каналом', () => {
        expect(stage(modelById('smart'), '1430').recognized).toBe('14:30');
        expect(stage(modelById('smart'), '14:30').recognized).toBeNull();
        expect(stage(modelById('mask'), '1430').recognized).toBeUndefined();
    });

    it('маска режет уже на вставке, умная — только по blur', () => {
        expect(modelById('mask').onPaste('14-16', { value: '', error: null, hint: null }).value).toBe('14:16');
        expect(modelById('smart').onPaste('14-16', { value: '', error: null, hint: null }).value).toBe('14-16');
    });

    it('вставка из одних пробелов не даёт ошибку формата у маски и умной', () => {
        expect(row(stage(modelById('mask'), '   '))).toEqual(['', null, null]);
        expect(row(stage(modelById('smart'), '   '))).toEqual(['', null, null]);
        expect(row(stage(modelById('as-is'), '   '))).toEqual(['   ', TIME_ERROR, null]);
    });

    it('умная модель склеивает строки в одну и ругается на неё по blur', () => {
        const smart = modelById('smart');
        const pasted = smart.onPaste('14:30\n15:00', { value: '', error: null, hint: null });

        // Склейка видна сразу: обе строки в поле одной строкой, без подсказки.
        expect(row(pasted)).toEqual(['14:30 15:00', null, null]);
        // Проверка по blur: это не одно время, значит ошибка формата.
        expect(row(smart.onBlur(pasted))).toEqual(['14:30 15:00', TIME_ERROR, null]);
    });

    it('вставка в 5000 символов не падает и не растит значение у маски', () => {
        const long = '1'.repeat(5000);
        expect(modelById('mask').onPaste(long, { value: '', error: null, hint: null }).value).toBe('11:11');
        expect(() => stage(modelById('smart'), long)).not.toThrow();
        expect(() => stage(modelById('as-is'), long)).not.toThrow();
    });
});
