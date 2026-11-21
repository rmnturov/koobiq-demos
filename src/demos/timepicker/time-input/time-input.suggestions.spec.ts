import { TimeValue } from './time-input.types';
import { filterTimeSuggestions, timeSuggestions, SUGGESTION_STEP } from './time-input.suggestions';

const time = (hours: number, minutes: number): TimeValue => ({
  hours,
  minutes,
  seconds: 0,
  milliseconds: 0,
});

const labels = (values: TimeValue[]): string[] =>
  values
    .slice(0, 4)
    .map(
      (value) =>
        `${String(value.hours).padStart(2, '0')}:${String(value.minutes).padStart(2, '0')}`,
    );

describe('time input suggestions', () => {
  it('starts at the next half hour for the current time', () => {
    const values = timeSuggestions(null, new Date(2026, 10, 9, 14, 12));

    expect(values).toHaveLength((24 * 60) / SUGGESTION_STEP);
    expect(labels(values)).toEqual(['14:30', '15:00', '15:30', '16:00']);
  });

  it('keeps the exact slot when the current time is on the grid', () => {
    const values = timeSuggestions(null, new Date(2026, 10, 9, 14, 30));

    expect(labels(values)[0]).toBe('14:30');
  });

  it('builds the grid around the value in the field', () => {
    const values = timeSuggestions(time(9, 5), new Date(2026, 10, 9, 20, 0));

    expect(labels(values)[0]).toBe('09:30');
  });

  it('wraps around midnight', () => {
    const values = timeSuggestions(time(23, 45), new Date(2026, 10, 9, 12, 0));

    expect(labels(values)).toEqual(['00:00', '00:30', '01:00', '01:30']);
  });

  it('covers every half hour of the day exactly once', () => {
    const labels = timeSuggestions(null, new Date(2026, 10, 9, 14, 12)).map(
      (value) => `${value.hours}:${value.minutes}`,
    );

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('keeps only the slots that start with the typed hours and minutes', () => {
    const grid = timeSuggestions(null, new Date(2026, 10, 9, 19, 20));
    const label = (value: TimeValue): string =>
      `${String(value.hours).padStart(2, '0')}:${String(value.minutes).padStart(2, '0')}`;

    expect(filterTimeSuggestions(grid, '11', label).map(label)).toEqual(['11:00', '11:30']);
    expect(filterTimeSuggestions(grid, '11:3', label).map(label)).toEqual(['11:30']);
    expect(filterTimeSuggestions(grid, '99', label)).toEqual([]);
  });

  it('sorts filtered slots by time instead of the grid order', () => {
    const grid = timeSuggestions(null, new Date(2026, 10, 9, 19, 20));
    const label = (value: TimeValue): string =>
      `${String(value.hours).padStart(2, '0')}:${String(value.minutes).padStart(2, '0')}`;
    const matches = filterTimeSuggestions(grid, '1', label).map(label);

    expect(matches).toHaveLength(20);
    expect(matches[0]).toBe('10:00');
    expect(matches.at(-1)).toBe('19:30');
  });

  it('matches the meridiem in the 12-hour cycle', () => {
    const grid = timeSuggestions(null, new Date(2026, 10, 9, 19, 20));
    const label = (value: TimeValue): string => {
      const hours = String(value.hours % 12 || 12).padStart(2, '0');

      return `${hours}:${String(value.minutes).padStart(2, '0')} ${value.hours < 12 ? 'AM' : 'PM'}`;
    };

    expect(filterTimeSuggestions(grid, '11:00 P', label).map(label)).toEqual(['11:00 PM']);
  });

  it('returns the whole grid for an empty query', () => {
    const grid = timeSuggestions(null, new Date(2026, 10, 9, 19, 20));
    const label = (value: TimeValue): string => `${value.hours}:${value.minutes}`;

    // Тот же массив: пробельный запрос выходит рано, а не фильтрует и сортирует копию.
    expect(filterTimeSuggestions(grid, ' ', label)).toBe(grid);
    expect(filterTimeSuggestions(grid, ' ', label)).toHaveLength((24 * 60) / SUGGESTION_STEP);
  });
});
