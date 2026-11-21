import { EMPTY_STATE, FieldModel, FieldState, modelById, typingState } from '../models/field-models';
import { Scenario, isTyping } from '../scenarios/scenarios';

/** Выделенный в сообщении фрагмент: границы в символах строки сценария. */
export type Selection = readonly [number, number];

/** Всё, что видно в сцене: поле, его фокус и выделение, плашка и подпись шага. */
export interface SceneState {
    field: FieldState;
    focused: boolean;
    selection: Selection | null;
    toast: string | null;
    caption: string;
}

/**
 * Подписи шагов вставки: сценарий проходит их по порядку.
 * Строки — часть сценария, поэтому живут рядом с состоянием, а не в шаблоне.
 */
export const CAPTIONS = {
    intro: 'В буфере строка',
    select: 'Выделяем строку',
    copy: '⌘C — копируем',
    focus: 'Фокус в поле',
    paste: '⌘V — вставляем',
    settle: 'Что стало с текстом',
    blur: 'Клик мимо — уходим из поля',
    outcome: 'Проверка по blur',
    rest: 'Итог'
} as const;

/** У ввода нет сообщения: шагов меньше, конец сцены тот же. */
export const TYPE_CAPTIONS = {
    focus: 'Клик в поле',
    type: 'Печатаем',
    blur: CAPTIONS.blur,
    outcome: CAPTIONS.outcome,
    rest: CAPTIONS.rest
} as const;

/**
 * Подписи, к которым приписывается вердикт: те, где результат поля уже есть —
 * разбор после вставки, проверка по blur и итог. До разбора поле не проверено, и
 * «поле пустое» на вступлении объявляло бы результат раньше действия.
 */
const RESULT_CAPTIONS: readonly string[] = [CAPTIONS.settle, CAPTIONS.blur, CAPTIONS.outcome, CAPTIONS.rest];

/** Нужен ли вердикт к этой подписи шага. */
export const showsVerdict = (caption: string): boolean => RESULT_CAPTIONS.includes(caption);

/** Начало сцены: пустое поле без фокуса, без выделения и без подписи. */
export function initialState(): SceneState {
    return { field: { ...EMPTY_STATE }, focused: false, selection: null, toast: null, caption: '' };
}

/**
 * Финальный кадр сценария — то, что видно под reduced-motion вместо мультика.
 * Считается теми же функциями модели, что и сам скрипт, без анимации.
 */
export function posterState(scenario: Scenario, model: FieldModel): SceneState {
    const field = isTyping(scenario)
        ? modelById('mask').onBlur(typingState(scenario.clipboard))
        : model.onBlur(model.onPaste(scenario.clipboard, EMPTY_STATE));

    return { field, focused: false, selection: null, toast: null, caption: CAPTIONS.rest };
}

/** Исход одной фразой: подсказка важнее значения, ошибка уточняет, остался ли текст. */
export function verdict(state: SceneState): string {
    const { value, error, hint, recognized } = state.field;

    if (recognized) {
        return `Распознано как ${recognized}`;
    }

    if (hint) {
        return hint;
    }

    if (error) {
        return value ? 'текст остался, ошибка' : 'текст не принят, ошибка';
    }

    return value ? `«${value}»` : 'поле пустое';
}
