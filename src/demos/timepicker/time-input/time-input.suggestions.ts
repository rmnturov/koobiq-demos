import { TimeValue } from './time-input.types';

/** Шаг сетки подсказок: полчаса, как в календарях и дейликах. */
export const SUGGESTION_STEP = 30;

/**
 * Отбирает варианты, подпись которых начинается с набранного текста.
 *
 * Сравнение идет по отображаемому тексту в текущем формате и цикле: `11` оставляет
 * `11:00` и `11:30`, `11:00 P` в 12-часовом цикле — только `11:00 PM`. Пустой запрос
 * оставляет сетку целиком. Совпадения сортируются по времени, потому что исходная сетка
 * начинается с ближайшего слота и после полуночи может идти не по возрастанию.
 */
export function filterTimeSuggestions(
  values: TimeValue[],
  query: string,
  format: (value: TimeValue) => string,
): TimeValue[] {
  const normalized = query.trim().toUpperCase();

  if (!normalized) {
    return values;
  }

  return values
    .filter((value) => format(value).toUpperCase().startsWith(normalized))
    .sort((left, right) => left.hours * 60 + left.minutes - (right.hours * 60 + right.minutes));
}

/**
 * Сетка времени с шагом `step` минут, начиная с ближайшего слота в будущее.
 *
 * Список циклический: после `23:30` идет `00:00`. Точка отсчета — распознанное значение поля,
 * а если его нет — текущее время. Так первым в списке стоит время, которое пользователь,
 * скорее всего, имеет в виду.
 */
export function timeSuggestions(
  anchor: TimeValue | null,
  now: Date,
  step = SUGGESTION_STEP,
): TimeValue[] {
  const anchorMinutes =
    anchor === null ? now.getHours() * 60 + now.getMinutes() : anchor.hours * 60 + anchor.minutes;
  const slots = Math.floor((24 * 60) / step);
  const start = Math.ceil(anchorMinutes / step) % slots;

  return Array.from({ length: slots }, (_, index) => {
    const slot = ((start + index) % slots) * step;
    const hours = Math.floor(slot / 60);
    const minutes = slot % 60;

    return { hours, minutes, seconds: 0, milliseconds: 0 };
  });
}
