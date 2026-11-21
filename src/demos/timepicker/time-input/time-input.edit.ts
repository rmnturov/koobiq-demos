import { segmentsOf } from './time-input.format';
import {
  ClearDirection,
  EditResult,
  HourCycle,
  Meridiem,
  Segment,
  Selection,
  TimeFormat,
} from './time-input.types';

/** Сегмент вместе с его местом в тексте поля: границы в символах, как у выделения. */
export interface SegmentSpan extends Selection {
  segment: Segment;
}

/** Ширина сегмента: часы, минуты и секунды — две цифры, миллисекунды — три, меридием — две буквы. */
const WIDTH: Record<Segment, number> = {
  hours: 2,
  minutes: 2,
  seconds: 2,
  milliseconds: 3,
  meridiem: 2,
};

/** Разделитель, который ставит маска перед сегментом; у часов его нет — они первые. */
const SEPARATOR: Record<Segment, string> = {
  hours: '',
  minutes: ':',
  seconds: ':',
  milliseconds: '.',
  meridiem: ' ',
};

/**
 * С каких цифр сегмент сам получает ведущий ноль: часы `3–9` дают `03–09` сразу,
 * минуты и секунды ждут второй цифры на `0–5` и дополняются на `6–9`.
 */
const LEADING_ZERO: Partial<Record<Segment, string>> = {
  hours: '3',
  minutes: '6',
  seconds: '6',
};

/** Символы-разделители: любой из них завершает сегмент и подставляет разделитель маски. */
const SEPARATORS = ':.-, ';

/** Часы, которые маска читает как полдень: `12:30` без меридиема — это 12:30 дня. */
const NOON_HOURS = '12';

/** Буквы половины суток: `a` и `p` в 12-часовом цикле ставят меридием. */
const MERIDIEM_KEYS: Record<string, Meridiem | undefined> = { a: 'AM', p: 'PM' };

const DIGIT = /^[0-9]$/;

/** Символы, которые поле принимает всегда: цифры и разделители `: . - ,` и пробел. */
const TYPED_CHAR = /^[0-9:.,\- ]$/;

/** Буквы половины суток, которые ставят меридием. */
const MERIDIEM_LETTER = /^[ap]$/i;

/** Вторая буква меридиема. */
const MERIDIEM_SECOND = /^m$/i;

/** Начатый меридием слева от символа: `m` допустима только в составе `AM`/`PM`. */
const MERIDIEM_TAIL = /[ap]m?$/i;

/** Часть маски: сегмент, его ширина и разделитель перед ним. */
interface Part {
  segment: Segment;
  width: number;
  separator: string;
}

/** Прочитанный вид: текст каждого сегмента и его границы в этом тексте. */
interface Readout {
  texts: string[];
  spans: SegmentSpan[];
}

/** Собранный из сегментов текст поля и границы каждого сегмента в нём. */
interface Rendered {
  view: string;
  starts: number[];
  ends: number[];
}

/** Порядок сегментов и разделители между ними: набор задаёт формат, места считает маска. */
function layout(format: TimeFormat, cycle: HourCycle): Part[] {
  return segmentsOf(format, cycle).map((segment) => ({
    segment,
    width: WIDTH[segment],
    separator: SEPARATOR[segment],
  }));
}

/** Границы сегментов в тексте поля; у ещё не начатых сегментов границы схлопнуты в его конец. */
export function segmentSpans(view: string, format: TimeFormat, cycle: HourCycle): SegmentSpan[] {
  return readView(view, layout(format, cycle)).spans;
}

/** Сегмент под позицией каретки; позиция за концом текста — последний сегмент. */
export function segmentAt(
  view: string,
  position: number,
  format: TimeFormat,
  cycle: HourCycle,
): Segment {
  const { spans } = readView(view, layout(format, cycle));

  return spans[segmentIndex(spans, position)].segment;
}

/** Выделение сегмента под позицией каретки: клик и переходы выделяют сегмент целиком. */
export function selectSegment(
  view: string,
  position: number,
  format: TimeFormat,
  cycle: HourCycle,
): Selection {
  const { spans } = readView(view, layout(format, cycle));
  const span = spans[segmentIndex(spans, position)];

  return { start: span.start, end: span.end };
}

/**
 * Ввод текста по текущему выделению. Символы обрабатываются по одному — как приходят
 * из `keydown` и IME: каждый либо меняет сегмент, либо завершает его, либо отбрасывается
 * (`rejected`) без правки вида. Отброшенный символ не мешает следующим в той же строке.
 */
export function insertText(
  view: string,
  selection: Selection,
  text: string,
  format: TimeFormat,
  cycle: HourCycle,
): EditResult {
  const parts = layout(format, cycle);
  let state: EditResult = { view, start: selection.start, end: selection.end, rejected: false };

  for (const char of Array.from(text)) {
    const step = insertChar(parts, state, char, cycle);
    state = {
      view: step.view,
      start: step.start,
      end: step.end,
      rejected: state.rejected || step.rejected,
    };
  }

  return state;
}

/**
 * Допустимый символ поля при текущем цикле часов; `before` — текст слева от символа: по нему
 * решается судьба `m`, которая бывает только второй буквой уже начатого `AM`/`PM`.
 */
export function isAllowedChar(char: string, cycle: HourCycle, before = ''): boolean {
  if (TYPED_CHAR.test(char)) {
    return true;
  }

  if (cycle !== 'h12') {
    return false;
  }

  return MERIDIEM_LETTER.test(char) || (MERIDIEM_SECOND.test(char) && MERIDIEM_TAIL.test(before));
}

/**
 * Оставляет в тексте только допустимые символы: после IME в поле не остаётся буквы мимо маски.
 * Каждый символ проверяется с уже пропущенным префиксом — от него зависит вторая буква меридиема.
 */
export function allowedOnly(text: string, cycle: HourCycle): string {
  let filtered = '';

  for (const char of Array.from(text)) {
    if (isAllowedChar(char, cycle, filtered)) {
      filtered += char;
    }
  }

  return filtered;
}

/**
 * Очищает сегмент под кареткой и все следующие: правка всегда срезает хвост маски.
 * `back` — это Backspace: на пустом сегменте он продолжает очистку слева, потому что каретка
 * стоит за разделителем и стирать под собой ей нечего (`12:` → пустое поле).
 * Меридием не очищается: половина суток в модели не бывает пустой, `Backspace` на нём
 * ничего не делает (спека, «Меридием не бывает пустым»).
 */
export function clearSegment(
  view: string,
  selection: Selection,
  format: TimeFormat,
  cycle: HourCycle,
  direction: ClearDirection = 'forward',
): EditResult {
  const parts = layout(format, cycle);
  const read = readView(view, parts);
  const index = clearedIndex(read, segmentIndex(read.spans, selection.start), direction);

  if (parts[index].segment === 'meridiem') {
    return { ...selection, view, rejected: false };
  }

  const texts = read.texts.map((text, position) => (position < index ? text : ''));
  const rendered = render(parts, texts, index);

  return {
    view: rendered.view,
    start: rendered.starts[index],
    end: rendered.starts[index],
    rejected: false,
  };
}

/**
 * Сегмент, который реально очищается. Backspace на пустом сегменте идёт влево до первого
 * непустого: в `12:` минуты пусты, и нажатие снимает часы; в `14:30:` за разделителем
 * секунд первое нажатие снимает минуты. Delete влево не ходит — ему нечего удалять позади.
 */
function clearedIndex(read: Readout, index: number, direction: ClearDirection): number {
  let target = index;

  while (direction === 'back' && target > 0 && read.texts[target] === '') {
    target -= 1;
  }

  return target;
}

/** Соседний сегмент в сторону шага; через край выделение не переходит. */
export function moveSelection(
  view: string,
  selection: Selection,
  step: number,
  format: TimeFormat,
  cycle: HourCycle,
): Selection {
  const { spans } = readView(view, layout(format, cycle));
  const index = segmentIndex(spans, selection.start) + Math.sign(step);
  const span = spans[clamp(index, 0, spans.length - 1)];

  return { start: span.start, end: span.end };
}

/** Первый или последний сегмент маски: `Home`/`PgUp` и `End`/`PgDn`. */
export function edgeSelection(
  view: string,
  edge: 'start' | 'end',
  format: TimeFormat,
  cycle: HourCycle,
): Selection {
  const { spans } = readView(view, layout(format, cycle));
  const span = edge === 'start' ? spans[0] : spans[spans.length - 1];

  return { start: span.start, end: span.end };
}

/** Один символ: буква меридиема, разделитель, цифра или запрещённый символ. */
function insertChar(parts: Part[], state: EditResult, char: string, cycle: HourCycle): EditResult {
  const read = readView(state.view, parts);
  const index = segmentIndex(read.spans, state.start);
  const key = char.toLowerCase();
  const meridiem = MERIDIEM_KEYS[key];

  if (cycle === 'h12' && key === 'm') {
    const meridiemAt = meridiemIndex(read);

    return { ...state, rejected: meridiemAt === -1 || read.texts[meridiemAt] === '' };
  }

  if (cycle === 'h12' && meridiem !== undefined) {
    return applyMeridiem(parts, read, state, meridiem);
  }

  if (SEPARATORS.includes(char)) {
    return finishSegment(parts, read, state, index);
  }

  if (DIGIT.test(char)) {
    return insertDigit(parts, read, state, index, char);
  }

  return { ...state, rejected: true };
}

/**
 * Меридием ставится из любого сегмента, но только когда циферблат набран до него: для `HH:mm`
 * это часы и минуты (Ruling). Раньше `a` и `p` ничего не делают — иначе в поле появляется
 * половина суток без времени, которую парсер не читает, а следующие цифры теряются.
 */
function applyMeridiem(
  parts: Part[],
  read: Readout,
  state: EditResult,
  meridiem: Meridiem,
): EditResult {
  const index = meridiemIndex(read);

  if (index === -1 || !clockFilled(parts, read.texts)) {
    return keepView(parts, read, state);
  }

  const texts = [...read.texts];

  texts[index] = meridiem;

  return placeCaret(parts, texts, index);
}

/**
 * Отброшенная буква не правит вид: маска только достраивает разделитель уже открытого сегмента
 * (`02` с кареткой в минутах — это `02:`), если от этого текст не теряет набранного.
 */
function keepView(parts: Part[], read: Readout, state: EditResult): EditResult {
  const index = segmentIndex(read.spans, state.start);
  const last = parts[index].segment === 'meridiem' ? Math.max(index - 1, 0) : index;
  const rendered = render(parts, read.texts, last);
  const view = rendered.view.startsWith(state.view) ? rendered.view : state.view;

  return {
    view,
    start: clamp(state.start, 0, view.length),
    end: clamp(state.end, 0, view.length),
    rejected: false,
  };
}

/** Разделитель завершает сегмент, дополняет одиночную цифру нулём и открывает следующий сегмент. */
function finishSegment(parts: Part[], read: Readout, state: EditResult, index: number): EditResult {
  const part = parts[index];
  const text = read.texts[index];

  if (text === '' || part.segment === 'meridiem') {
    return { ...state, rejected: false };
  }

  const texts = [...read.texts];
  const following = index + 1;

  texts[index] = pad(part, text);

  return opensNext(parts, following)
    ? openSegment(parts, texts, following)
    : placeCaret(parts, texts, index);
}

/**
 * Цифра заменяет выделение и дописывает сегмент; заполненный сегмент переводит к следующему.
 * Выделение сначала обрезается по границам сегмента под своим началом (Ruling): хвост за сегментом
 * не заменяется, поэтому выделение «конец минут → меридием» не дописывает цифру к минутам.
 * В конце заполненного сегмента без выделения цифра игнорируется — маска не дописывает
 * за кареткой; внутри сегмента она заменяет знак под кареткой.
 */
function insertDigit(
  parts: Part[],
  read: Readout,
  state: EditResult,
  index: number,
  digit: string,
): EditResult {
  const part = parts[index];
  const span = read.spans[index];
  const text = read.texts[index];
  const start = clamp(state.start, span.start, span.end);
  const end = clamp(state.end, start, span.end);
  const atEnd = start === end && start >= span.end;

  if (part.segment === 'meridiem' || (atEnd && text.length >= part.width)) {
    return { ...state, rejected: false };
  }

  const from = clamp(start - span.start, 0, text.length);
  const to = clamp(end - span.start, from, text.length);
  const merged =
    start === end
      ? text.slice(0, from) + digit + text.slice(from + 1)
      : text.slice(0, from) + digit + text.slice(to);
  const texts = [...read.texts];
  const following = index + 1;

  texts[index] = padTyped(part, merged);

  if (texts[index].length < part.width) {
    return placeCaret(parts, texts, index);
  }

  return opensNext(parts, following) && read.texts[following] === ''
    ? openSegment(parts, texts, following)
    : placeCaret(parts, texts, index);
}

/** Дополняет набранную с нуля цифру ведущим нулём, если она уже не может быть первой в паре. */
function padTyped(part: Part, text: string): string {
  const threshold = LEADING_ZERO[part.segment];

  if (threshold === undefined || text.length !== 1) {
    return text;
  }

  return text >= threshold ? `0${text}` : text;
}

/** Разделитель после одной цифры читает её как полный сегмент: `9:` — это `09:`. */
function pad(part: Part, text: string): string {
  if (text.length >= part.width) {
    return text;
  }

  return part.width === 2 ? text.padStart(2, '0') : text.padEnd(part.width, '0');
}

/** Следующий сегмент открывается после заполнения текущего; меридием открывает буква, не разделитель. */
function opensNext(parts: Part[], index: number): boolean {
  return index < parts.length && parts[index].segment !== 'meridiem';
}

/** Показывает сегмент `index` (пустым или с текстом) и ставит каретку в его начало. */
function openSegment(parts: Part[], texts: string[], index: number): EditResult {
  const rendered = render(parts, texts, index);

  return {
    view: rendered.view,
    start: rendered.starts[index],
    end: rendered.starts[index],
    rejected: false,
  };
}

/** Ставит каретку в конец изменённого сегмента, не перескакивая к следующему. */
function placeCaret(parts: Part[], texts: string[], index: number): EditResult {
  const rendered = render(parts, texts, lastFilled(texts));

  return {
    view: rendered.view,
    start: rendered.ends[index],
    end: rendered.ends[index],
    rejected: false,
  };
}

/** Читает тексты сегментов и их границы: разделитель учитывается, только если он есть в виде. */
function readView(view: string, parts: Part[]): Readout {
  const texts: string[] = [];
  const spans: SegmentSpan[] = [];
  let offset = 0;

  for (const [index, part] of parts.entries()) {
    if (index > 0 && view.startsWith(part.separator, offset)) {
      offset += part.separator.length;
    }

    const text = readSegment(view, offset, part.width);

    spans.push({ segment: part.segment, start: offset, end: offset + text.length });
    texts.push(text);
    offset += text.length;
  }

  return { texts, spans };
}

/** Символы сегмента от его начала: не больше ширины и до ближайшего разделителя. */
function readSegment(view: string, offset: number, width: number): string {
  let text = '';

  while (text.length < width && offset + text.length < view.length) {
    const char = view.charAt(offset + text.length);

    if (SEPARATORS.includes(char)) {
      break;
    }

    text += char;
  }

  return text;
}

/**
 * Собирает вид из текстов сегментов по `last` включительно; остальные сегменты не показываются.
 * Меридием по умолчанию достраивается сам и потому показывается всегда.
 */
function render(parts: Part[], texts: readonly string[], last: number): Rendered {
  const shown = [...texts];
  const meridiem = defaultMeridiemIndex(parts, shown);
  const upto = meridiem === -1 ? last : Math.max(last, meridiem);

  if (meridiem !== -1) {
    shown[meridiem] = defaultMeridiem(parts, shown);
  }

  const starts: number[] = [];
  const ends: number[] = [];
  let view = '';

  for (const [index, part] of parts.entries()) {
    if (index > 0 && index <= upto) {
      view += part.separator;
    }

    starts.push(view.length);

    if (index <= upto) {
      view += shown[index] ?? '';
    }

    ends.push(view.length);
  }

  return { view, starts, ends };
}

/**
 * Сегмент меридиема, который маска показывает по умолчанию: в 12-часовом цикле `AM`
 * появляется вместе с последним сегментом до меридиема, иначе вид расходится с `formValue`,
 * а у половины суток нет места в тексте — до него не добраться кареткой.
 */
function defaultMeridiemIndex(parts: readonly Part[], texts: readonly string[]): number {
  const index = parts.findIndex((part) => part.segment === 'meridiem');

  return index !== -1 && (texts[index] ?? '') === '' && clockFilled(parts, texts) ? index : -1;
}

/**
 * Половина суток, которую маска достраивает сама: при часах `12` это `PM` (Ruling), иначе `AM`.
 * Парсер читает строку без меридиема как 24-часовую, то есть `12:30` — полдень; с `AM` в поле
 * набранное `12:30` расходилось бы со вставленным (`12:30 AM` — это 00:30). Остальные часы
 * получают `AM` — то же, что даёт парсер.
 */
function defaultMeridiem(parts: readonly Part[], texts: readonly string[]): Meridiem {
  const hours = parts.findIndex((part) => part.segment === 'hours');

  return hours !== -1 && texts[hours] === NOON_HOURS ? 'PM' : 'AM';
}

/**
 * Все сегменты до меридиема набраны: для `HH:mm` это часы и минуты (Ruling), а в точных
 * форматах ещё секунды и миллисекунды — иначе `AM` встал бы за висящим разделителем
 * (`02:30: AM`), которого парсер не читает.
 */
function clockFilled(parts: readonly Part[], texts: readonly string[]): boolean {
  return parts.every(
    (part, index) => part.segment === 'meridiem' || (texts[index] ?? '').length >= part.width,
  );
}

/** Последний непустой сегмент: вид обрывается на нём, пустой хвост не показывается. */
function lastFilled(texts: readonly string[]): number {
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    if (texts[index] !== '') {
      return index;
    }
  }

  return 0;
}

/** Индекс сегмента под позицией каретки; за концом текста — последний сегмент. */
function segmentIndex(spans: readonly SegmentSpan[], position: number): number {
  const index = spans.findIndex((span) => span.start <= position && position <= span.end);

  return index === -1 ? spans.length - 1 : index;
}

/** Индекс сегмента меридиема: в 24-часовом цикле его в маске нет. */
function meridiemIndex(read: Readout): number {
  return read.spans.findIndex((span) => span.segment === 'meridiem');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
