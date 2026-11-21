import {
  allowedOnly,
  clearSegment,
  edgeSelection,
  insertText,
  isAllowedChar,
  moveSelection,
  segmentAt,
  segmentSpans,
  selectSegment,
} from './time-input.edit';
import { parseView } from './time-input.parse';

const at = (start: number, end = start) => ({ start, end });

describe('time input editing', () => {
  it('maps segments to spans', () => {
    expect(segmentSpans('14:30', 'HH:mm', 'h23')).toEqual([
      { segment: 'hours', start: 0, end: 2 },
      { segment: 'minutes', start: 3, end: 5 },
    ]);
    expect(segmentSpans('14:30:15.250', 'HH:mm:ss.SSS', 'h23').map((span) => span.segment)).toEqual(
      ['hours', 'minutes', 'seconds', 'milliseconds'],
    );
    expect(segmentSpans('02:30 PM', 'HH:mm', 'h12').at(-1)).toEqual({
      segment: 'meridiem',
      start: 6,
      end: 8,
    });
  });

  it('finds a segment under the caret', () => {
    expect(segmentAt('14:30', 0, 'HH:mm', 'h23')).toBe('hours');
    expect(segmentAt('14:30', 3, 'HH:mm', 'h23')).toBe('minutes');
    expect(segmentAt('14:', 3, 'HH:mm', 'h23')).toBe('minutes');
    expect(segmentAt('', 0, 'HH:mm', 'h23')).toBe('hours');
    expect(segmentAt('02:30 PM', 7, 'HH:mm', 'h12')).toBe('meridiem');
  });

  it('selects a whole segment', () => {
    expect(selectSegment('14:30', 4, 'HH:mm', 'h23')).toEqual(at(3, 5));
    expect(selectSegment('', 0, 'HH:mm', 'h23')).toEqual(at(0, 0));
  });

  it.each([
    ['', at(0), '1', 'HH:mm', 'h23', '1', at(1), false],
    ['1', at(1), '4', 'HH:mm', 'h23', '14:', at(3), false],
    ['14:', at(3), '3', 'HH:mm', 'h23', '14:3', at(4), false],
    ['14:3', at(4), '0', 'HH:mm', 'h23', '14:30', at(5), false],
    ['', at(0), '9', 'HH:mm', 'h23', '09:', at(3), false],
    ['14:30', at(3, 5), '5', 'HH:mm', 'h23', '14:5', at(4), false],
    ['14:30', at(0, 2), '7', 'HH:mm', 'h23', '07:30', at(2), false],
    ['14:30', at(5), '2', 'HH:mm', 'h23', '14:30', at(5), false],
    ['9', at(1), ':', 'HH:mm', 'h23', '09:', at(3), false],
    ['14', at(2), ' ', 'HH:mm', 'h23', '14:', at(3), false],
    ['14:30:15.', at(9), '2', 'HH:mm:ss.SSS', 'h23', '14:30:15.2', at(10), false],
    ['14', at(2), 'a', 'HH:mm', 'h23', '14', at(2), true],
    ['14', at(2), '/', 'HH:mm', 'h23', '14', at(2), true],
    ['02:30', at(5), 'p', 'HH:mm', 'h12', '02:30 PM', at(8), false],
    ['', at(0), 'a', 'HH:mm', 'h12', '', at(0), false],
  ] as const)(
    'types %j at %j into %j',
    (view, selection, text, format, cycle, nextView, nextSelection, rejected) => {
      expect(insertText(view, selection, text, format, cycle)).toEqual({
        view: nextView,
        start: nextSelection.start,
        end: nextSelection.end,
        rejected,
      });
    },
  );

  it('accepts digits and separators in both cycles', () => {
    for (const char of ['0', '3', '9', ':', '.', '-', ',', ' ']) {
      expect(isAllowedChar(char, 'h23')).toBe(true);
      expect(isAllowedChar(char, 'h12')).toBe(true);
    }
  });

  it('accepts the meridiem letters only in the 12-hour cycle', () => {
    expect(isAllowedChar('a', 'h12')).toBe(true);
    expect(isAllowedChar('P', 'h12')).toBe(true);
    expect(isAllowedChar('a', 'h23')).toBe(false);
    expect(isAllowedChar('p', 'h23')).toBe(false);
    expect(isAllowedChar('m', 'h23', '02:30 P')).toBe(false);
  });

  it('lets the m of am and pm in only after the meridiem letter', () => {
    expect(isAllowedChar('m', 'h12')).toBe(false);
    expect(isAllowedChar('m', 'h12', '02:30')).toBe(false);
    expect(isAllowedChar('m', 'h12', '02:30 A')).toBe(true);
    expect(isAllowedChar('m', 'h12', '02:30 p')).toBe(true);
    expect(isAllowedChar('m', 'h12', '02:30 AM')).toBe(true);
  });

  it('rejects every other character', () => {
    expect(isAllowedChar('/', 'h12')).toBe(false);
    expect(isAllowedChar('/', 'h23')).toBe(false);
    expect(isAllowedChar('x', 'h23')).toBe(false);
    expect(isAllowedChar('b', 'h12')).toBe(false);
  });

  it('filters the text down to the allowed characters', () => {
    expect(allowedOnly('14:30a', 'h23')).toBe('14:30');
    expect(allowedOnly('1/2', 'h23')).toBe('12');
    expect(allowedOnly('02:30 PM', 'h12')).toBe('02:30 PM');
    expect(allowedOnly('14:30 pm', 'h12')).toBe('14:30 pm');
    expect(allowedOnly('14:30 m', 'h12')).toBe('14:30 ');
  });

  it('clears the segment and everything after it', () => {
    expect(clearSegment('14:30', at(0, 2), 'HH:mm', 'h23')).toEqual({
      view: '',
      start: 0,
      end: 0,
      rejected: false,
    });
    expect(clearSegment('14:30', at(3, 5), 'HH:mm', 'h23')).toEqual({
      view: '14:',
      start: 3,
      end: 3,
      rejected: false,
    });
    expect(clearSegment('14:30:15.250', at(6, 8), 'HH:mm:ss.SSS', 'h23')).toEqual({
      view: '14:30:',
      start: 6,
      end: 6,
      rejected: false,
    });
  });

  it('continues clearing to the left when Backspace hits an empty segment', () => {
    // `12:` — каретка за разделителем, минуты пусты: нажатие стирает часы, а не молчит.
    expect(clearSegment('12:', at(3), 'HH:mm', 'h23', 'back')).toEqual({
      view: '',
      start: 0,
      end: 0,
      rejected: false,
    });
    // `14:30:` в формате с секундами: секунды не начаты, поэтому первое нажатие снимает минуты.
    expect(clearSegment('14:30:', at(6), 'HH:mm:ss', 'h23', 'back')).toEqual({
      view: '14:',
      start: 3,
      end: 3,
      rejected: false,
    });
  });

  it('keeps Delete on the segment under the caret', () => {
    // Delete не ходит влево: на пустых минутах в `12:` ему нечего удалять.
    expect(clearSegment('12:', at(3), 'HH:mm', 'h23')).toEqual({
      view: '12:',
      start: 3,
      end: 3,
      rejected: false,
    });
  });

  it('moves between segments and to the edges', () => {
    expect(moveSelection('14:30:15', at(0, 2), 1, 'HH:mm:ss', 'h23')).toEqual(at(3, 5));
    expect(moveSelection('14:30:15', at(3, 5), 1, 'HH:mm:ss', 'h23')).toEqual(at(6, 8));
    expect(moveSelection('14:30:15', at(6, 8), 1, 'HH:mm:ss', 'h23')).toEqual(at(6, 8));
    expect(moveSelection('14:30:15', at(3, 5), -1, 'HH:mm:ss', 'h23')).toEqual(at(0, 2));
    expect(edgeSelection('14:30:15', 'start', 'HH:mm:ss', 'h23')).toEqual(at(0, 2));
    expect(edgeSelection('14:30:15', 'end', 'HH:mm:ss', 'h23')).toEqual(at(6, 8));
    expect(edgeSelection('02:30 PM', 'end', 'HH:mm', 'h12')).toEqual(at(6, 8));
  });

  it('keeps the spans on the text that is actually in the field', () => {
    expect(segmentSpans('14:3', 'HH:mm:ss', 'h23')).toEqual([
      { segment: 'hours', start: 0, end: 2 },
      { segment: 'minutes', start: 3, end: 4 },
      { segment: 'seconds', start: 4, end: 4 },
    ]);
    expect(segmentAt('14:3', 4, 'HH:mm:ss', 'h23')).toBe('minutes');
    expect(selectSegment('14:3', 4, 'HH:mm:ss', 'h23')).toEqual(at(3, 4));
    expect(selectSegment('02:30', 5, 'HH:mm', 'h12')).toEqual(at(3, 5));
  });

  it('opens the next segment once the current one is full', () => {
    expect(insertText('14:3', at(4), '0', 'HH:mm:ss', 'h23')).toEqual({
      view: '14:30:',
      start: 6,
      end: 6,
      rejected: false,
    });
    expect(insertText('14:3', at(3), '0', 'HH:mm:ss', 'h23').view).toBe('14:0');
  });

  it('lands on the start of the next segment even when it is already filled', () => {
    expect(insertText('14:30:15', at(4), ':', 'HH:mm:ss', 'h23')).toEqual({
      view: '14:30:15',
      start: 6,
      end: 6,
      rejected: false,
    });
    expect(insertText('14:3:15', at(4), ':', 'HH:mm:ss', 'h23')).toEqual({
      view: '14:03:15',
      start: 6,
      end: 6,
      rejected: false,
    });
  });

  it('replaces the digit under the caret inside a full segment', () => {
    expect(insertText('14:30:15', at(4), '5', 'HH:mm:ss', 'h23')).toEqual({
      view: '14:35:15',
      start: 5,
      end: 5,
      rejected: false,
    });
  });

  it('types the whole mask as one text', () => {
    expect(insertText('', at(0), '1430', 'HH:mm', 'h23')).toEqual({
      view: '14:30',
      start: 5,
      end: 5,
      rejected: false,
    });
    expect(insertText('', at(0), '14x30', 'HH:mm', 'h23')).toEqual({
      view: '14:30',
      start: 5,
      end: 5,
      rejected: true,
    });
  });

  it('builds a 12-hour view and switches the meridiem', () => {
    const typed = insertText('', at(0), '0230', 'HH:mm', 'h12');
    expect(typed).toEqual({ view: '02:30 AM', start: 5, end: 5, rejected: false });
    expect(insertText(typed.view, typed, 'p', 'HH:mm', 'h12')).toEqual({
      view: '02:30 PM',
      start: 8,
      end: 8,
      rejected: false,
    });
    expect(insertText('02:30 PM', at(6, 8), 'a', 'HH:mm', 'h12')).toEqual({
      view: '02:30 AM',
      start: 8,
      end: 8,
      rejected: false,
    });
  });

  it('shows AM by default once the hours and minutes are typed', () => {
    expect(insertText('02:3', at(4), '0', 'HH:mm', 'h12')).toEqual({
      view: '02:30 AM',
      start: 5,
      end: 5,
      rejected: false,
    });
    expect(segmentSpans('02:30 AM', 'HH:mm', 'h12').at(-1)).toEqual({
      segment: 'meridiem',
      start: 6,
      end: 8,
    });
    expect(edgeSelection('02:30 AM', 'end', 'HH:mm', 'h12')).toEqual(at(6, 8));

    const typed = insertText('', at(0), '0230', 'HH:mm', 'h12');

    expect(moveSelection(typed.view, typed, 1, 'HH:mm', 'h12')).toEqual(at(6, 8));
    expect(moveSelection('02:30 AM', at(6, 8), 1, 'HH:mm', 'h12')).toEqual(at(6, 8));
  });

  it('defaults the meridiem to PM for the noon hour', () => {
    const typed = insertText('12:3', at(4), '0', 'HH:mm', 'h12');

    expect(typed).toEqual({ view: '12:30 PM', start: 5, end: 5, rejected: false });
    expect(segmentSpans(typed.view, 'HH:mm', 'h12').at(-1)).toEqual({
      segment: 'meridiem',
      start: 6,
      end: 8,
    });
    expect(parseView(typed.view, 'HH:mm', 'h12')).toEqual({
      hours: 12,
      minutes: 30,
      seconds: 0,
      milliseconds: 0,
    });
    expect(insertText('', at(0), '1230', 'HH:mm', 'h12').view).toBe('12:30 PM');
    expect(insertText('', at(0), '0230', 'HH:mm', 'h12').view).toBe('02:30 AM');
    expect(insertText('12:30 PM', at(8), 'a', 'HH:mm', 'h12').view).toBe('12:30 AM');
  });

  it('clamps a selection that runs past the active segment', () => {
    expect(insertText('02:30 AM', at(5, 8), '5', 'HH:mm', 'h12')).toEqual({
      view: '02:30 AM',
      start: 5,
      end: 8,
      rejected: false,
    });
    expect(insertText('14:30:15', at(5, 7), '5', 'HH:mm:ss', 'h23')).toEqual({
      view: '14:30:15',
      start: 5,
      end: 7,
      rejected: false,
    });
    expect(insertText('14:30', at(0, 5), '7', 'HH:mm', 'h23')).toEqual({
      view: '07:30',
      start: 2,
      end: 2,
      rejected: false,
    });
  });

  it('keeps a view without a meridiem text from looping the caret', () => {
    expect(moveSelection('02:30', at(3, 5), 1, 'HH:mm', 'h12')).toEqual(at(5, 5));
    expect(moveSelection('02:30', at(5, 5), 1, 'HH:mm', 'h12')).toEqual(at(5, 5));
    expect(insertText('', at(0), '0230', 'HH:mm', 'h12').view).toBe('02:30 AM');
  });

  it('waits for the whole clock before showing AM in precise formats', () => {
    expect(insertText('', at(0), '0230', 'HH:mm:ss', 'h12').view).toBe('02:30:');
    expect(insertText('', at(0), '023045', 'HH:mm:ss', 'h12')).toEqual({
      view: '02:30:45 AM',
      start: 8,
      end: 8,
      rejected: false,
    });
    expect(insertText('02:30', at(5), 'p', 'HH:mm:ss', 'h12')).toEqual({
      view: '02:30',
      start: 5,
      end: 5,
      rejected: false,
    });
  });

  it('ignores a and p until the minutes are typed', () => {
    const ignored = insertText('02', at(3), 'p', 'HH:mm', 'h12');

    expect(ignored).toEqual({ view: '02:', start: 3, end: 3, rejected: false });
    expect(insertText(ignored.view, ignored, '30', 'HH:mm', 'h12')).toEqual({
      view: '02:30 AM',
      start: 5,
      end: 5,
      rejected: false,
    });
    expect(insertText('02:', at(3), 'a', 'HH:mm', 'h12')).toEqual({
      view: '02:',
      start: 3,
      end: 3,
      rejected: false,
    });
  });

  it('accepts the m of am and pm silently and keeps the meridiem', () => {
    expect(insertText('02:30 PM', at(8), 'm', 'HH:mm', 'h12')).toEqual({
      view: '02:30 PM',
      start: 8,
      end: 8,
      rejected: false,
    });
    expect(insertText('02:30', at(5), 'm', 'HH:mm', 'h12').rejected).toBe(true);
    expect(clearSegment('02:30 PM', at(6, 8), 'HH:mm', 'h12')).toEqual({
      view: '02:30 PM',
      start: 6,
      end: 8,
      rejected: false,
    });
  });
});
