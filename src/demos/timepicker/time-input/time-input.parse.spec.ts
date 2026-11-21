import { completeView, normalizeForParse, parseView, pasteOutcome } from './time-input.parse';

const time = (hours: number, minutes: number, seconds = 0, milliseconds = 0) => ({
  hours,
  minutes,
  seconds,
  milliseconds,
});

describe('time input parsing', () => {
  it.each([
    ['14:30', 'HH:mm', 'h23', time(14, 30)],
    ['14:30:15', 'HH:mm:ss', 'h23', time(14, 30, 15)],
    ['14:30:15.250', 'HH:mm:ss.SSS', 'h23', time(14, 30, 15, 250)],
    ['14:30:15.250', 'HH:mm', 'h23', time(14, 30, 15, 250)],
    ['14:30', 'HH:mm:ss', 'h23', time(14, 30)],
    ['9:5', 'HH:mm', 'h23', time(9, 5)],
    ['14-30', 'HH:mm', 'h23', time(14, 30)],
    ['14.30', 'HH:mm', 'h23', time(14, 30)],
    ['14 30', 'HH:mm', 'h23', time(14, 30)],
    ['14 30 15', 'HH:mm:ss', 'h23', time(14, 30, 15)],
    ['14:3:5', 'HH:mm:ss', 'h23', time(14, 3, 5)],
    ['14-30-15', 'HH:mm:ss', 'h23', time(14, 30, 15)],
    ['1430', 'HH:mm', 'h23', time(14, 30)],
    ['1430', 'HH:mm:ss', 'h23', time(14, 30)],
    ['143015', 'HH:mm:ss', 'h23', time(14, 30, 15)],
    ['143015', 'HH:mm', 'h23', time(14, 30, 15)],
    ['143015250', 'HH:mm:ss.SSS', 'h23', time(14, 30, 15, 250)],
    ['143015250', 'HH:mm', 'h23', time(14, 30, 15, 250)],
    ['143015250', 'HH:mm:ss', 'h23', time(14, 30, 15, 250)],
    ['14:30:15.5', 'HH:mm:ss.SSS', 'h23', time(14, 30, 15, 500)],
    ['14:30:15.25', 'HH:mm:ss.SSS', 'h23', time(14, 30, 15, 250)],
    ['2:30 pm', 'HH:mm', 'h12', time(14, 30)],
    ['2 30 pm', 'HH:mm', 'h12', time(14, 30)],
    ['02:30 PM', 'HH:mm', 'h12', time(14, 30)],
    ['12:00 AM', 'HH:mm', 'h12', time(0, 0)],
    ['12:00 PM', 'HH:mm', 'h12', time(12, 0)],
    ['14:30', 'HH:mm', 'h12', time(14, 30)],
    ['02:30', 'HH:mm', 'h12', time(2, 30)],
    ['2:30 pm', 'HH:mm', 'h23', time(14, 30)],
    ['встреча в 15:30', 'HH:mm', 'h23', time(15, 30)],
    ['  14:30  ', 'HH:mm', 'h23', time(14, 30)],
  ] as const)('reads %s in %s / %s', (view, format, cycle, expected) => {
    expect(parseView(view, format, cycle)).toEqual(expected);
  });

  it.each([
    ['9:', 'HH:mm'],
    ['143', 'HH:mm'],
    ['14305', 'HH:mm:ss'],
    ['14.30.250', 'HH:mm:ss.SSS'],
    ['12.05.2025', 'HH:mm'],
    ['https://example.com/74-169/', 'HH:mm'],
    ['15:30 и 16:00', 'HH:mm'],
    ['abc123', 'HH:mm'],
    ['25:99', 'HH:mm'],
    ['13:30 pm', 'HH:mm'],
  ] as const)('does not read %s as time in %s', (view, format) => {
    expect(parseView(view, format, 'h23')).toBeNull();
  });

  it.each([
    ['12', 'HH:mm', 'h23', time(12, 0)],
    ['9', 'HH:mm', 'h23', time(9, 0)],
    ['0', 'HH:mm', 'h23', time(0, 0)],
    ['12 pm', 'HH:mm', 'h12', time(12, 0)],
    ['12 am', 'HH:mm', 'h12', time(0, 0)],
    ['09:05', 'HH:mm', 'h23', time(9, 5)],
    ['14:30:15.250', 'HH:mm', 'h23', time(14, 30, 15, 250)],
  ] as const)('completes %s in %s / %s on blur', (view, format, cycle, expected) => {
    expect(completeView(view, format, cycle)).toEqual(expected);
  });

  it.each(['24', '123', 'abc123', '', '25:00'])('does not complete %s', (view) => {
    expect(completeView(view, 'HH:mm', 'h23')).toBeNull();
  });

  it('normalizes whitespace', () => {
    expect(normalizeForParse('  14:30  ')).toBe('14:30');
    expect(normalizeForParse('14:30\n\n')).toBe('14:30');
    expect(normalizeForParse('14:30\n\n 15:00')).toBe('14:30 15:00');
  });

  it('decides what a paste is', () => {
    expect(pasteOutcome('14-30', 'HH:mm', 'h23')).toEqual({
      kind: 'recognized',
      value: time(14, 30),
    });
    expect(pasteOutcome('встреча в 15:30', 'HH:mm', 'h23')).toEqual({
      kind: 'recognized',
      value: time(15, 30),
    });
    expect(pasteOutcome('abc123', 'HH:mm', 'h23')).toEqual({ kind: 'as-is', text: 'abc123' });
    expect(pasteOutcome('12.05.2025', 'HH:mm', 'h23')).toEqual({
      kind: 'as-is',
      text: '12.05.2025',
    });
    // Несколько строк нормализуются: время здесь неоднозначно, вставляется склеенный текст.
    expect(pasteOutcome('  14:30\n\n 15:00  ', 'HH:mm', 'h23')).toEqual({
      kind: 'as-is',
      text: '14:30 15:00',
    });
    // Одна строка с временем среди текста читается однозначно: остальное отбрасывается.
    expect(pasteOutcome('Встреча\nв 15:30', 'HH:mm', 'h23')).toEqual({
      kind: 'recognized',
      value: time(15, 30),
    });
  });
});
