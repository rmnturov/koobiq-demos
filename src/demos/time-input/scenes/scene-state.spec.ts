import { modelById } from '../models/field-models';
import { SCENARIOS } from '../scenarios/scenarios';
import { CAPTIONS, TYPE_CAPTIONS, initialState, posterState, showsVerdict, verdict } from './scene-state';

const byId = (id: string) => SCENARIOS.find((scenario) => scenario.id === id)!;

describe('scene state', () => {
    it('starts empty and unfocused', () => {
        expect(initialState()).toEqual({ field: { value: '', error: null, hint: null }, focused: false, selection: null, toast: null, caption: '' });
    });

    it('shows the final value of the paste scenario as the poster', () => {
        expect(posterState(byId('range'), modelById('mask')).field).toEqual({ value: '14:16', error: null, hint: null });
        expect(posterState(byId('range'), modelById('mask')).caption).toBe('Итог');
    });

    it('keeps an error in the poster when the model rejects the value', () => {
        expect(posterState(byId('url'), modelById('mask')).field.error).toContain('Введите время');
        // Две строки умная модель склеивает в одну, а по blur ругается на формат.
        expect(posterState(byId('multiline'), modelById('smart')).field).toEqual({
            value: '14:30 15:00',
            error: 'Введите время в формате ЧЧ:ММ, например 14:30',
            hint: null
        });
    });

    it('describes the result in one phrase', () => {
        expect(verdict({ field: { value: '14:16', error: null, hint: null }, focused: false, selection: null, toast: null, caption: '' })).toBe('«14:16»');
        expect(verdict({ field: { value: '14-16', error: 'Введите время в формате ЧЧ:ММ, например 14:30', hint: null }, focused: false, selection: null, toast: null, caption: '' })).toBe('текст остался, ошибка');
        expect(verdict({ field: { value: '', error: 'Введите время в формате ЧЧ:ММ, например 14:30', hint: null }, focused: false, selection: null, toast: null, caption: '' })).toBe('текст не принят, ошибка');
        expect(verdict({ field: { value: '15:30', error: null, hint: null, recognized: '15:30' }, focused: false, selection: null, toast: null, caption: '' })).toBe('Распознано как 15:30');
    });

    // Вердикт — про результат поля: до разбора результата нет, и объявлять нечего.
    it('attaches the verdict only to the captions that follow the check', () => {
        expect(showsVerdict(CAPTIONS.intro)).toBe(false);
        expect(showsVerdict(CAPTIONS.select)).toBe(false);
        expect(showsVerdict(CAPTIONS.copy)).toBe(false);
        expect(showsVerdict(CAPTIONS.focus)).toBe(false);
        expect(showsVerdict(CAPTIONS.paste)).toBe(false);
        expect(showsVerdict(TYPE_CAPTIONS.type)).toBe(false);

        expect(showsVerdict(CAPTIONS.settle)).toBe(true);
        expect(showsVerdict(CAPTIONS.blur)).toBe(true);
        expect(showsVerdict(CAPTIONS.outcome)).toBe(true);
        expect(showsVerdict(CAPTIONS.rest)).toBe(true);
        expect(showsVerdict(TYPE_CAPTIONS.rest)).toBe(true);
    });
});
