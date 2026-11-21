/**
 * Поведение текущего `input kbqTimepicker` без Angular: набор с клавиатуры, вставка из буфера, стрелки
 * и blur.
 *
 * Все регулярки, числа и порядок веток перенесены из `timepicker.directive.ts` как есть, включая
 * странности: панель сравнения показывает старый контрол таким, какой он есть, а не таким, каким
 * его хотелось бы видеть. Модель работает только с форматом `HH:mm` — другой старый контрол в демо
 * не показывает.
 */

export interface OldState {
  /** Что видно в поле. */
  view: string;
  /** Значение формы — `HH:mm` или null, пока время не собрано целиком. */
  value: string | null;
  /**
   * Каретка в поле. После перерисовки директива выделяет измененный сегмент и оставляет каретку на
   * его начале, поэтому позиция в начале сегмента здесь означает «сегмент выделен».
   */
  caret: number;
  /**
   * Последний ввод не попал в поле: директива сообщает об этом выходом `incorrectInput`, и по нему
   * панель показывает «Только цифры». Флаг держится только до следующего действия — как подсказка,
   * которая гаснет сама.
   */
  rejected: boolean;
}

export const OLD_EMPTY: OldState = { view: '', value: null, caret: 0, rejected: false };

/** Максимум часа и минуты в директиве: `HOURS_PER_DAY = 23`, `MINUTES_PER_HOUR = 59`. */
const HOURS_PER_DAY = 23;
const MINUTES_PER_HOUR = 59;
const SECONDS_PER_MINUTE = 59;

/** Максимум цифр в одной части времени. */
const TIME_PART_LENGTH = 2;

const HOURS_MINUTES_SECONDS_REGEXP = /^([0-1][0-9]|2[0-3]):?([0-5][0-9]):?([0-5][0-9])?$/;
const HOURS_MINUTES_REGEXP = /^([0-1][0-9]|2[0-3]):?([0-5][0-9])?$/;
const HOURS_ONLY_REGEXP = /^([0-1][0-9]|2[0-3]):?$/;
/** 12-часовой вид: пробел перед AM/PM обязателен, `m` можно опустить (`2:30 p` тоже разбирается). */
const AM_PM_FORMAT_REGEXP = /^([0-1]?[0-9]):([0-5]?[0-9]) ([ap][m]?$)/i;

interface TimeValue {
  hours: number;
  minutes: number;
}

export type OldSegment = 'hours' | 'minutes';

/** Набор одного символа: то, что директива делает в `onKeyDown()` и следующем за ним `onInput()`. */
export function oldType(state: OldState, char: string): OldState {
  // Буква: директива гасит клавишу до вставки и просит «Только цифры».
  if (isLetter(char)) {
    return { ...state, rejected: true };
  }

  // Пробел директива обрабатывает своей ветвью (`spaceKeyHandler`) и не отвергает никогда.
  if (isSpace(char)) {
    return onSpace(state);
  }

  if (!isDigit(char)) {
    // Разделитель директива вставляет сама, в позицию каретки, и гоняет через `replaceSymbols`.
    const draft = insert(state.view, state.caret, char);

    if (replaceSymbols(draft) === draft) {
      return { ...state, rejected: true };
    }

    return onInput({ ...state, view: replaceSymbols(draft) }, state.caret + char.length);
  }

  // Цифру вставляет браузер: она заменяет выделение, которое директива оставила на сегменте.
  const { start, end } = selectedRange(state.view, state.caret);
  const view = state.view.slice(0, start) + char + state.view.slice(end);

  return onInput({ ...state, view }, start + char.length);
}

/** Стрелка по сегменту: шаг значения по кругу, вид перерисовывается из значения. */
export function oldStep(
  state: OldState,
  segment: OldSegment,
  delta: number,
  shift: boolean,
): OldState {
  // Shift+стрелка для директивы — движение по полю, а не шаг значения; отказа она тоже не повторяет.
  if (shift) {
    return clearRejection(state);
  }

  const value = state.value ? parseTime(state.value) : null;

  // Пустое поле: шагать не от чего, директива выходит до любых изменений.
  if (!value) {
    return clearRejection(state);
  }

  const stepped: TimeValue =
    segment === 'hours'
      ? { ...value, hours: wrap(value.hours + delta, HOURS_PER_DAY + 1) }
      : { ...value, minutes: wrap(value.minutes + delta, MINUTES_PER_HOUR + 1) };
  const view = formatTime(stepped);

  return {
    ...state,
    view,
    value: view,
    caret: segmentMetrics(view, segment === 'hours' ? 0 : view.indexOf(':') + 1).start,
    rejected: false,
  };
}

/**
 * Уход из поля: директива сравнивает вид с каноном значения, а на расхождении прогоняет вид тем же
 * путем, что и набор, — `formatUserPaste`, затем `onInput`.
 *
 * Так читается склейка из двухстрочной вставки: `formatUserPaste` собирает группы `14`, `3015`, `00`
 * в `14:59:00`, `onInput` поджимает минуты к `59` и разбирает строку, и в поле с формой оказывается
 * `14:59` — ровно то, что видно при вставке уже склеенного текста без перевода строки.
 */
export function oldBlur(state: OldState): OldState {
  // Вид совпадает с каноном значения — пересобирать нечего, и `incorrectInput` директива не шлет.
  if (state.view === canonicalOf(state.value)) {
    return clearRejection(state);
  }

  return onInput({ ...state, view: formatUserPaste(state.view) }, state.caret);
}

/**
 * Порт `onPaste()`: вставка заменяет поле целиком, поэтому прежнее состояние не нужно, а вид и
 * значение целиком определяются текстом из буфера.
 *
 * Директиву видно в двух исходах: разобранный текст она перерисовывает каноном `HH:mm` и отдает в
 * форму, неразобранный — оставляет в поле как есть (там же его и нормализует `formatUserPaste`).
 * Поле однострочное, поэтому переводы строки оно из вида выбрасывает — но только из вида: разбор
 * идет по исходному тексту, и `'1\n2'` директива успевает прочесть как `01:02`.
 */
export function oldPaste(text: string): OldState {
  const formatted = formatUserPaste(text);
  const parsed = parseTime(formatted);
  // Неразобранный текст директива оставляет прежним видом; `oldPaste` без прежнего вида показывает
  // текст пасты — другого исхода у неразобранной вставки нет: ветка «часы не нашлись» кладет его в
  // поле сама, а разобранный на этом шаге текст всегда форматируется.
  const view = parsed ? formatTime(parsed) : sanitizeInputValue(formatted);

  return {
    view,
    value: parsed ? view : null,
    // Поле получает значение целиком, и каретка в нем встает в конец.
    caret: view.length,
    // Паста не отвергается никогда: `incorrectInput` директива на нее не эмитит.
    rejected: false,
  };
}

/**
 * Порт `spaceKeyHandler()`: пробел не отвергается никогда — он либо работает разделителем, как
 * двоеточие (`'2'` + пробел дают `02:00`), либо переводит выделение на следующий сегмент, либо
 * не делает ничего молча — без `incorrectInput`.
 */
function onSpace(state: OldState): OldState {
  const { start, end } = selectedRange(state.view, state.caret);

  // Сегмент выделен: директива не вставляет пробел, а ставит выделение на следующий сегмент.
  if (start !== end) {
    // `indexOf` вернул -1 на последнем сегменте — в директиве это тоже truthy, поэтому выделение
    // переходит на часы.
    const nextDivider = state.view.indexOf(':', state.caret);
    const cursor = nextDivider ? nextDivider + 1 : 0;

    return {
      ...state,
      caret: segmentMetrics(state.view, cursor).start,
      rejected: false,
    };
  }

  const draft = insert(state.view, state.caret, ' ');

  if (replaceSymbols(draft) === draft) {
    return clearRejection(state);
  }

  return onInput({ ...state, view: replaceSymbols(draft) }, state.caret + 1);
}

/** Порт `onInput()`: нормализация, разбор в значение и перерисовка вида. */
function onInput(state: OldState, caretAfterEdit: number): OldState {
  const formatted = formatUserInput(state.view);
  const parsed = parseTime(formatted);
  const nextView = parsed ? formatTime(parsed) : formatted;
  // Собранное время директива перерисовывает всегда, недобранное — только если нормализация его
  // укоротила; иначе лишние цифры копились бы в поле без предела.
  const rewritten = !!parsed || nextView !== state.view;
  const view = rewritten ? nextView : state.view;

  return {
    view,
    // Недобранный вид значение не меняет: директива не отдает в форму недособранное время.
    value: parsed ? nextView : view ? state.value : null,
    // Директива выделяет сегмент, в который попала каретка после правки.
    caret: rewritten ? segmentMetrics(view, caretAfterEdit + 1).start : caretAfterEdit,
    rejected: false,
  };
}

/** Что заменит набранный символ: выделенный сегмент, если каретка на его начале, иначе ничего. */
function selectedRange(view: string, caret: number): { start: number; end: number } {
  const { start, end } = segmentMetrics(view, caret);

  return caret === start ? { start, end } : { start: caret, end: caret };
}

/** Порт `getTimeEditMetrics()`: границы сегмента, в котором стоит каретка. */
function segmentMetrics(view: string, caret: number): { start: number; end: number } {
  const hoursStart = 0;
  const minutesStart = view.indexOf(':', hoursStart + 1);
  const secondsStart = minutesStart !== -1 ? view.indexOf(':', minutesStart + 1) : -1;

  if (secondsStart !== -1 && caret > secondsStart) {
    return { start: secondsStart + 1, end: view.length };
  }

  if (minutesStart !== -1 && caret > minutesStart) {
    return { start: minutesStart + 1, end: secondsStart > -1 ? secondsStart : view.length };
  }

  return { start: hoursStart, end: minutesStart !== -1 ? minutesStart : view.length };
}

/** Порт `formatUserInput()`: сначала символы, потом числа — порядок в директиве именно такой. */
function formatUserInput(value: string): string {
  return replaceNumbers(replaceSymbols(value));
}

/** Порт `replaceSymbols()`: `2:` превращается в `02:`, чтобы часть времени набралась двумя цифрами. */
function replaceSymbols(value: string): string {
  let formattedValue: string = value;

  const match: RegExpMatchArray | null = value.match(
    /^(\d\d:){0,2}(?<number>[0-9])(?<symbol>\W)(:\d\d){0,2}$/,
  );

  if (match?.groups) {
    const { number, symbol } = match.groups;

    formattedValue = value.replace(number + symbol, `0${number}`);
  }

  return formattedValue;
}

/** Порт `replaceNumbers()`: каждая часть обрезается до двух цифр и поджимается к своему максимуму. */
function replaceNumbers(value: string): string {
  let formattedValue: string = value;

  const match: RegExpMatchArray | null = value.match(
    /^(?<hours>\d*):?(?<minutes>\d*):?(?<seconds>\d*)$/,
  );

  if (match?.groups) {
    const { hours, minutes, seconds } = match.groups;

    if (hours.length) {
      formattedValue = formattedValue.replace(hours, normalizeTimePart(hours, HOURS_PER_DAY));
    }

    if (minutes.length) {
      formattedValue = formattedValue.replace(
        minutes,
        normalizeTimePart(minutes, MINUTES_PER_HOUR),
      );
    }

    if (seconds.length) {
      formattedValue = formattedValue.replace(
        seconds,
        normalizeTimePart(seconds, SECONDS_PER_MINUTE),
      );
    }
  }

  return formattedValue;
}

/** Порт `normalizeTimePart()`: часть до двух цифр пропускается, длиннее — поджимается к максимуму. */
function normalizeTimePart(part: string, maxValue: number): string {
  if (part.length <= TIME_PART_LENGTH && parseInt(part) <= maxValue) {
    return part;
  }

  return `${Math.min(parseInt(part), maxValue)}`.padStart(TIME_PART_LENGTH, '0');
}

/**
 * Порт `formatUserPaste()`: вид доводится до `чч:мм:сс` и заново нормализуется.
 * Секунды остаются в строке и отваливаются на разборе — так же, как в директиве для формата `HH:mm`.
 */
function formatUserPaste(value: string): string {
  // 12-часовой вид директива не трогает: его разбирает отдельная ветка `getDateFromTimeString()`.
  if (value.match(AM_PM_FORMAT_REGEXP)) {
    return value;
  }

  const match: RegExpMatchArray | null = value.match(
    /^(\D+)?(?<hours>\d+)?(\D+)?(\D+)?(?<minutes>\d+)?(\D+)?(\D+)?(?<seconds>\d+)?(\D+)?$/,
  );

  if (!match?.groups?.['hours']) {
    return value;
  }

  return replaceNumbers(
    Object.values(match.groups)
      .map((group) => (group || '').padStart(TIME_PART_LENGTH, '0'))
      .join(':'),
  );
}

/** Порт `getDateFromTimeString()` без даты: модели нужны только часы и минуты. */
function parseTime(timeString: string): TimeValue | null {
  if (!timeString) {
    return null;
  }

  const amPm = timeString.match(AM_PM_FORMAT_REGEXP);
  const HMS = timeString.match(HOURS_MINUTES_SECONDS_REGEXP);
  const HM = timeString.match(HOURS_MINUTES_REGEXP);
  const H = timeString.match(HOURS_ONLY_REGEXP);

  // Ветка AM/PM стоит первой, как в директиве: часы она отдает уже в 24-часовом виде.
  if (amPm) return parseMeridiemTime(amPm);
  if (HMS) return { hours: Number(HMS[1]), minutes: Number(HMS[2]) };
  if (HM) return { hours: Number(HM[1]), minutes: Number(HM[2] || 0) };
  if (H) return { hours: Number(H[1]), minutes: 0 };

  return null;
}

/**
 * Ветка AM/PM из `getDateFromTimeString()`: `12` часов с `am` и любой `pm` директива переводит в
 * 24-часовой вид, а получившиеся 24 часа отдает дате — та перекатывает сутки, и в поле выходит `00`.
 * Модель повторяет перекат остатком по модулю.
 */
function parseMeridiemTime(match: RegExpMatchArray): TimeValue {
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  const shifted =
    /[p]/i.test(meridiem) || (/[a]/i.test(meridiem) && hours === 12) ? hours + 12 : hours;

  return { hours: wrap(shifted, HOURS_PER_DAY + 1), minutes };
}

/** Однострочное поле выбрасывает переводы строки из значения — так текст пасты и склеивается. */
const sanitizeInputValue = (value: string): string => value.replace(/[\r\n]/g, '');

/**
 * Порт `getTimeStringFromDate()`: у пустого значения канона нет, и директива отдает пустую строку —
 * этим же сравнением она решает на уходе фокуса, пересобирать вид или нет.
 */
const canonicalOf = (value: string | null): string => value ?? '';

const formatTime = ({ hours, minutes }: TimeValue): string =>
  `${`${hours}`.padStart(TIME_PART_LENGTH, '0')}:${`${minutes}`.padStart(TIME_PART_LENGTH, '0')}`;

/** Остаток по модулю с положительным результатом: `-1` по модулю `24` — это `23`. */
const wrap = (value: number, limit: number): number => ((value % limit) + limit) % limit;

const isDigit = (char: string): boolean => /^\d$/.test(char);

const isSpace = (char: string): boolean => char === ' ';

/**
 * Гасит флаг отказа там, где директива молчит: `incorrectInput` — сообщение о текущем событии, а не
 * состояние поля. Возвращает тот же объект, если гасить нечего, — модель не плодит копии зря.
 */
const clearRejection = (state: OldState): OldState =>
  state.rejected ? { ...state, rejected: false } : state;

/** Директива проверяет код клавиши (`isLetterKey`), поэтому буквой для нее остается только латиница. */
const isLetter = (char: string): boolean => /^[a-z]$/i.test(char);

const insert = (view: string, at: number, char: string): string =>
  view.slice(0, at) + char + view.slice(at);
