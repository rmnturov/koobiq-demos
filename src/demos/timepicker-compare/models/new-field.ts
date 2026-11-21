/**
 * Поведение нового поля `kbqTimeInput` без Angular: набор с клавиатуры, вставка из буфера, шаг
 * сегмента и blur.
 *
 * Разбор, маска и шаг уже живут в модулях прототипа (`time-input.edit`, `time-input.parse`,
 * `time-input.format`, `time-input.increment`); здесь только адаптер — состояние панели и те же
 * вызовы в том порядке, в каком их делает `time-input.directive.ts`. Ни разбора, ни маски, ни
 * форматирования этот файл не повторяет.
 */

import { insertText, segmentAt, segmentSpans } from '../../timepicker/time-input/time-input.edit';
import { errorText, formValue, formatTime } from '../../timepicker/time-input/time-input.format';
import { incrementValue } from '../../timepicker/time-input/time-input.increment';
import {
  completeView,
  parseView,
  pasteOutcome,
} from '../../timepicker/time-input/time-input.parse';
import {
  HourCycle,
  Segment,
  Selection,
  TimeFormat,
  TimeValue,
} from '../../timepicker/time-input/time-input.types';

export interface NewState {
  /** Что видно в поле: маска нового поля, а не текст, который набрал пользователь. */
  view: string;
  /** Выделение в поле: каретка — это `selection.start`, замена сегмента — `start`…`end`. */
  selection: Selection;
  /** Значение формы — канон `HH:mm` (или точнее) в 24-часовом виде, пока время не собрано. */
  value: string | null;
  /**
   * Ошибка разбора: поднимается по blur и живет до первого вида, который снова читается, — так же,
   * как `validationArmed && parseErrorState` у директивы.
   */
  error: string | null;
  /** Тултип распознавания: `Распознано как 15:30` после вставки или канонизации по blur. */
  recognized: string | null;
  /** Последний символ не попал в поле — панель зажигает «Только цифры». */
  rejected: boolean;
}

/** Текст тултипа распознавания: та же строка, что собирает директива (`RECOGNIZED_PREFIX`). */
const RECOGNIZED_PREFIX = 'Распознано как ';

/** Полночь, с которой директива начинает шаг на пустом поле. */
const ZERO: TimeValue = { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 };

/**
 * Пустое поле. Точность и цикл часов состоянию не нужны — их знает каждая функция, — но сигнатура
 * держит их рядом с остальными вызовами: панель создает поле тем же форматом, что и показывает.
 */
export const newEmpty = (_format: TimeFormat, _cycle: HourCycle): NewState => ({
  view: '',
  selection: { start: 0, end: 0 },
  value: null,
  error: null,
  recognized: null,
  rejected: false,
});

/**
 * Набор одного символа: маска правит вид по текущему выделению, значение собирается из нового вида.
 * Новую ошибку набор не поднимает — директива показывает её только по blur, — но и не гасит
 * поднятую: `applyEdit` пересчитывает лишь `parseErrorState`, а проверку снимает удачное чтение
 * вида. Отказ гасит тултип распознавания: он относился к прежнему значению поля.
 */
export function newType(
  state: NewState,
  char: string,
  format: TimeFormat,
  cycle: HourCycle,
): NewState {
  const edit = insertText(state.view, state.selection, char, format, cycle);
  // Отказ не меняет вид, поэтому директива и значение формы не трогает.
  const value = edit.rejected ? state.value : formValueOf(edit.view, format, cycle);

  return {
    view: edit.view,
    selection: { start: edit.start, end: edit.end },
    value,
    error: edit.rejected ? state.error : errorAfterEdit(state.error, edit.view, value),
    recognized: edit.rejected ? null : state.recognized,
    rejected: edit.rejected,
  };
}

/**
 * Вставка из буфера. Распознанное время заменяет поле каноном текущего формата и сообщает о
 * распознавании; неразобранный текст директива вставляет в каретку как есть и включает сырое
 * состояние — разбора у него нет до blur. Ошибку, поднятую по blur, такая вставка не гасит:
 * `readView` пересчитывает `parseErrorState`, а не проверку.
 */
export function newPaste(
  state: NewState,
  text: string,
  format: TimeFormat,
  cycle: HourCycle,
): NewState {
  const outcome = pasteOutcome(text, format, cycle);

  if (outcome.kind === 'recognized') {
    const view = formatTime(outcome.value, format, cycle);

    return {
      view,
      // Значение приходит целиком, каретка встает в конец — как `applyPaste` у директивы.
      selection: { start: view.length, end: view.length },
      value: formValue(outcome.value, format),
      error: null,
      recognized: `${RECOGNIZED_PREFIX}${view}`,
      rejected: false,
    };
  }

  const { start, end } = state.selection;
  const view = state.view.slice(0, start) + outcome.text + state.view.slice(end);
  const caret = start + outcome.text.length;
  const value = formValueOf(view, format, cycle);

  return {
    view,
    selection: { start: caret, end: caret },
    value,
    error: errorAfterEdit(state.error, view, value),
    // Пустая вставка ничего не распознала: подсказке не о чем говорить.
    recognized: null,
    rejected: false,
  };
}

/**
 * Шаг сегмента: порт `increment` из директивы. `delta` приходит в единицах — умножение на
 * `LARGE_STEP` для Shift делает вызывающий, как и сама директива на входе.
 *
 * Сегмент берется из каретки: вид перерисовывается целиком, и шагает тот сегмент, который под
 * выделением. Пустое поле сегментов не имеет — директива начинает с часов, поэтому `segment`
 * нужен только для него. Шагается значение, прочитанное из вида: отдельного `valueState`, как у
 * директивы, модель не держит — все её состояния собраны её же функциями, и они совпадают.
 */
export function newStep(
  state: NewState,
  segment: Segment,
  delta: number,
  format: TimeFormat,
  cycle: HourCycle,
): NewState {
  const current = parseView(state.view, format, cycle);

  // Нераспознанный вид: шагать не от чего — директива выходит до любых изменений, вид и ошибка
  // остаются прежними.
  if (current === null && state.view.length > 0) {
    return { ...state, rejected: false };
  }

  const target = targetSegment(state, segment, format, cycle);
  const stepped = incrementValue(current ?? ZERO, target, delta);
  const view = formatTime(stepped, format, cycle);
  const span = segmentSpans(view, format, cycle).find((item) => item.segment === target);

  return {
    view,
    // Выделение — на тот же сегмент в новом тексте: он остается под кареткой.
    selection: { start: span?.start ?? 0, end: span?.end ?? 0 },
    value: formValue(stepped, format),
    // Удачный шаг делает вид читаемым, поэтому ошибка разбора снимается.
    error: null,
    // Директива тултип распознавания на стрелках не трогает: он живет своим таймером.
    recognized: state.recognized,
    rejected: false,
  };
}

/**
 * Уход из поля: директива дочитывает недонабранное (`12` — это `12:00`), перерисовывает вид
 * каноном и только после этого разбирает его. Ошибка показывается ровно здесь и только на
 * непустом виде: пустое поле для директивы валидно.
 */
export function newBlur(state: NewState, format: TimeFormat, cycle: HourCycle): NewState {
  const value = completeView(state.view, format, cycle);
  const blank = state.view.trim().length === 0;
  const view = value !== null ? formatTime(value, format, cycle) : blank ? '' : state.view;
  const rewritten = view !== state.view;

  return {
    view,
    // Вид переписан — каретка встает в его конец; иначе директива поле не трогает.
    selection: rewritten ? { start: view.length, end: view.length } : state.selection,
    value: value === null ? null : formValue(value, format),
    error: value === null && !blank ? errorText(format, cycle) : null,
    // Канонизация, переписавшая вид, сообщает о распознавании — как `recognizeOnBlur()`.
    recognized: value !== null && rewritten ? `${RECOGNIZED_PREFIX}${view}` : null,
    rejected: false,
  };
}

/** Сегмент, который шагает: под кареткой, а на пустом поле — тот, что передал вызывающий. */
function targetSegment(
  state: NewState,
  segment: Segment,
  format: TimeFormat,
  cycle: HourCycle,
): Segment {
  return state.view.length === 0
    ? segment
    : segmentAt(state.view, state.selection.start, format, cycle);
}

/** Значение формы из вида: что директива отдала бы форме после `parseView`. */
function formValueOf(view: string, format: TimeFormat, cycle: HourCycle): string | null {
  const value = parseView(view, format, cycle);

  return value === null ? null : formValue(value, format);
}

/**
 * Ошибка после правки. Директива в `applyEdit` пересчитывает только `parseErrorState`, а
 * `validationArmed` снимает лишь удачное чтение вида (`readView`), поэтому ошибка, поднятая по
 * blur, живет до первого читаемого вида. Пустой вид — не ошибка: `errorText()` требует непустой
 * нераспознанный вид.
 */
function errorAfterEdit(error: string | null, view: string, value: string | null): string | null {
  return value !== null || view.length === 0 ? null : error;
}
