import { segmentAt } from '../timepicker/time-input/time-input.edit';
import { CASES, CaseOutcome, CompareCase, casesOf } from './cases';
import { NewState, newEmpty, newPaste, newStep, newType } from './models/new-field';
import {
  OLD_EMPTY,
  OldSegment,
  OldState,
  oldBlur,
  oldPaste,
  oldStep,
  oldType,
} from './models/old-field';
import { LARGE_STEP, STEP } from './models/steps';

/** Состояние старого контрола из `from`: поле заполнено, каретка в конце вида. */
const oldStart = (from: CaseOutcome | null): OldState =>
  from
    ? { view: from.view, value: from.value, caret: from.view.length, rejected: false }
    : OLD_EMPTY;

/** Состояние нового поля из `from`: поле заполнено, каретка в конце вида. */
const newStart = (item: CompareCase): NewState => {
  const empty = newEmpty(item.format, item.cycle);

  if (!item.from) {
    return empty;
  }

  const caret = item.from.view.length;

  return {
    ...empty,
    view: item.from.view,
    value: item.from.value,
    selection: { start: caret, end: caret },
  };
};

/**
 * Сегмент под кареткой — тот, который шагает стрелка. В `HH:mm` сегментов два, поэтому кроме часов
 * остаётся только минута; `newStep` берёт сегмент из каретки сам, старому контролу он нужен явно.
 */
const segmentUnderCaret = (item: CompareCase, view: string): OldSegment =>
  segmentAt(view, view.length, item.format, item.cycle) === 'hours' ? 'hours' : 'minutes';

/** Шаг стрелки в единицах: направление и крупный шаг Shift — как у директивы на входе в `increment`. */
const stepOf = (shift: boolean): number => (shift ? LARGE_STEP : STEP);

/**
 * Направления нажатий кейса: `times` шагов вверх, затем при `back` столько же вниз.
 * Сценарий мультика и проверка данных читают один и тот же набор.
 */
const pressesOf = (item: CompareCase): number[] => {
  if (item.action.kind !== 'key') {
    return [];
  }

  const times = item.action.times ?? 1;
  const up = Array.from({ length: times }, () => 1);

  return item.action.back ? [...up, ...up.map(() => -1)] : up;
};

/** Прогон действия через модель старого контрола. */
const runOld = (item: CompareCase): OldState => {
  const start = oldStart(item.from);

  switch (item.action.kind) {
    case 'type':
      return Array.from(item.action.text).reduce((state, char) => oldType(state, char), start);
    case 'paste':
      return oldPaste(item.action.text);
    case 'key': {
      const shift = item.action.shift;

      return pressesOf(item).reduce(
        (state, direction) =>
          oldStep(state, segmentUnderCaret(item, state.view), stepOf(shift) * direction, shift),
        start,
      );
    }
  }
};

/** Прогон действия через модель нового поля. */
const runNew = (item: CompareCase): NewState => {
  const start = newStart(item);

  switch (item.action.kind) {
    case 'type':
      return Array.from(item.action.text).reduce(
        (state, char) => newType(state, char, item.format, item.cycle),
        start,
      );
    case 'paste':
      return newPaste(start, item.action.text, item.format, item.cycle);
    case 'key': {
      const shift = item.action.shift;

      return pressesOf(item).reduce(
        (state, direction) =>
          newStep(
            state,
            segmentUnderCaret(item, state.view),
            stepOf(shift) * direction,
            item.format,
            item.cycle,
          ),
        start,
      );
    }
  }
};

/**
 * Конец прохода — тот же, что играет блок: там, где новое поле не собрало значение,
 * уход из поля происходит на обеих сторонах в одном кадре, и старый контрол тоже
 * получает blur. Кейс `multiline` на этом и стоит: без blur в поле осталась бы
 * склейка `14:3015:00`, а с ним директива доводит вид до `14:59`.
 *
 * Кейсы, которые кончаются результатом действия, фокуса не теряют — у них исход
 * прежний, и придумывать им второй кадр нечего.
 */
const oldEnd = (state: OldState, next: NewState): OldState =>
  next.value === null ? oldBlur(state) : state;

describe('comparison cases', () => {
  it('keeps the declared order inside each section', () => {
    expect(casesOf('type').map((item) => item.id)).toEqual([
      'range-typing',
      'shift-step',
      'meridiem-typing',
    ]);
    expect(casesOf('paste').map((item) => item.id)).toEqual([
      'sentence',
      'digits',
      'date',
      'url',
      'junk',
      'invalid',
      'multiline',
      'range',
      'clean',
      'meridiem-paste',
    ]);
  });

  it('has a caption for both sides and a non-empty title', () => {
    for (const item of CASES) {
      expect(item.title.trim()).not.toBe('');
      expect(item.caption.old.trim()).not.toBe('');
      expect(item.caption.next.trim()).not.toBe('');
    }
  });

  it('runs the live pair and every case but the meridiem one in h23', () => {
    expect(CASES.filter((item) => item.cycle === 'h12').map((item) => item.id)).toEqual([
      'meridiem-typing',
    ]);
  });

  /*
   * Пометка `noDiff` — решение о секции, а не украшение кейса: страница по ней выносит
   * пару под заголовок «Где разницы нет», и ошибка здесь читается как реклама или как
   * потерянный проигрыш. Состав пометки держит этот спек, а не список id на странице:
   * переименование кейса не должно молча переносить его в другую секцию.
   */
  it('marks the honest pairs the page shows under the no-diff heading', () => {
    expect(CASES.filter((item) => item.noDiff).map((item) => item.id)).toEqual([
      'range',
      'clean',
      'meridiem-paste',
    ]);
  });

  it('marks only pairs where both sides give the same outcome', () => {
    for (const item of CASES.filter((entry) => entry.noDiff)) {
      // Иначе пометка обещает равенство, которого в кадре нет.
      expect(item.old.view).toBe(item.next.view);
      expect(item.old.value).toBe(item.next.value);
    }
  });

  describe('data matches the models', () => {
    for (const item of CASES) {
      it(`${item.id}: ${item.title}`, () => {
        const next = runNew(item);
        const old = oldEnd(runOld(item), next);

        // У директивы нет тултипа распознавания: исход слева его и не описывает.
        expect(item.old.recognized).toBeUndefined();
        expect({ view: old.view, value: old.value }).toEqual({
          view: item.old.view,
          value: item.old.value,
        });
        expect({
          view: next.view,
          value: next.value,
          recognized: next.recognized ?? undefined,
        }).toEqual(item.next);
      });
    }
  });
});
