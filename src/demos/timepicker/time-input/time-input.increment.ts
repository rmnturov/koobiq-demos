import { Segment, TimeValue } from './time-input.types';

/** Шаг меридиема: половина суток в часах. */
const HALF_DAY = 12;

/**
 * Меняет одну часть времени на `delta` по кругу в её пределах; остальные части не трогает.
 * Отдельной ветки для 12-часового цикла нет: часы хранятся в 24-часовом виде, поэтому шаг
 * часов сам дает переход `11 → 12` с переключением меридиема, а `23 → 00` — по кругу.
 */
export function incrementValue(value: TimeValue, segment: Segment, delta: number): TimeValue {
  switch (segment) {
    case 'hours':
      return { ...value, hours: wrap(value.hours + delta, 24) };
    case 'minutes':
      return { ...value, minutes: wrap(value.minutes + delta, 60) };
    case 'seconds':
      return { ...value, seconds: wrap(value.seconds + delta, 60) };
    case 'milliseconds':
      return { ...value, milliseconds: wrap(value.milliseconds + delta, 1000) };
    case 'meridiem':
      return { ...value, hours: wrap(value.hours + HALF_DAY * delta, 24) };
  }
}

/** Остаток по модулю с положительным результатом: `-1` по модулю `24` — это `23`. */
function wrap(value: number, limit: number): number {
  return ((value % limit) + limit) % limit;
}
