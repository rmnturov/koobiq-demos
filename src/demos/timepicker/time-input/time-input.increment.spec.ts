import { incrementValue } from './time-input.increment';

const value = (hours: number, minutes: number, seconds = 0, milliseconds = 0) => ({
  hours,
  minutes,
  seconds,
  milliseconds,
});

describe('time input increment', () => {
  it.each([
    [value(23, 59, 59, 999), 'hours', 1, value(0, 59, 59, 999)],
    [value(23, 59, 59, 999), 'minutes', 1, value(23, 0, 59, 999)],
    [value(23, 59, 59, 999), 'seconds', 1, value(23, 59, 0, 999)],
    [value(23, 59, 59, 999), 'milliseconds', 1, value(23, 59, 59, 0)],
    [value(0, 0, 0, 0), 'hours', -1, value(23, 0, 0, 0)],
    [value(11, 0), 'hours', 1, value(12, 0)],
    [value(12, 0), 'hours', 1, value(13, 0)],
    [value(23, 0), 'hours', 1, value(0, 0)],
    [value(11, 0), 'meridiem', 1, value(23, 0)],
    [value(23, 0), 'meridiem', 1, value(11, 0)],
  ] as const)('steps %j by %s / %d', (input, segment, delta, expected) => {
    expect(incrementValue(input, segment, delta)).toEqual(expected);
  });
});
