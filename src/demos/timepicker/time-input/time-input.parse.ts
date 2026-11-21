import { HourCycle, Meridiem, TimeFormat, TimeValue } from './time-input.types';

/** Итог вставки: однозначно распознанное время или нормализованный текст как есть. */
export type PasteOutcome =
  | { kind: 'recognized'; value: TimeValue }
  | { kind: 'as-is'; text: string };

/** Разобранные части до проверки диапазонов: группы цифр как есть, чтобы не терять точность. */
interface RawParts {
  hours: string;
  minutes: string;
  seconds?: string;
  milliseconds?: string;
  meridiem?: Meridiem;
}

/** Попытка чтения: строка похожа на время (`matched`) и что из неё вышло. */
interface Attempt {
  matched: boolean;
  value: TimeValue | null;
}

const NON_PRINTABLE = /[\p{Cc}\p{Cf}]+/gu;

/**
 * Группы во всех шаблонах именованные: число групп у них разное (у пробельного нет
 * миллисекунд), и позиционный разбор читал бы `pm` как миллисекунды.
 */
const COLON =
  /^(?<hours>\d{1,2}):(?<minutes>\d{1,2})(?::(?<seconds>\d{1,2})(?:\.(?<milliseconds>\d{1,3}))?)?\s*(?<meridiem>am|pm)?$/i;
const DASH =
  /^(?<hours>\d{1,2})-(?<minutes>\d{1,2})(?:-(?<seconds>\d{1,2})(?:\.(?<milliseconds>\d{1,3}))?)?\s*(?<meridiem>am|pm)?$/i;
const DOTS =
  /^(?<hours>\d{1,2})\.(?<minutes>\d{1,2})(?:\.(?<seconds>\d{1,2})(?:\.(?<milliseconds>\d{1,3}))?)?\s*(?<meridiem>am|pm)?$/i;
const SPACED =
  /^(?<hours>\d{1,2})\s+(?<minutes>\d{1,2})(?:\s+(?<seconds>\d{1,2}))?\s*(?<meridiem>am|pm)?$/i;
const DIGITS = /^(\d+)\s*(am|pm)?$/i;

/** Только часы: недонабранное время досрочно не читается, но по blur дополняется нулями. */
const HOURS_ONLY = /^(?<hours>\d{1,2})\s*(?<meridiem>am|pm)?$/i;

const GROUPED = [COLON, DASH, DOTS, SPACED];

/**
 * Кандидат во время внутри текста: рядом не должно быть цифры, `/`, `@`, `.` или `-`,
 * иначе `74-169` из ссылки или `05.2025` из даты читались бы как время.
 */
const IN_TEXT =
  /(?<![\d/@.\-])(\d{1,2}[:.\-]\d{1,2}(?:[:.\-]\d{1,2}(?:\.\d{1,3})?)?|\d{4}|\d{6}|\d{9}|\d{1,2}\s+\d{1,2})(?:\s*(?:am|pm))?(?![\d/@.\-])/gi;

/** Убирает непечатные символы и лишние пробелы: переводы строк становятся одним пробелом. */
export function normalizeForParse(text: string): string {
  return text.replace(NON_PRINTABLE, ' ').replace(/\s+/g, ' ').trim();
}

/** Переводит часы с меридиемом в 24-часовой вид: `12 AM` — полночь, `12 PM` — полдень. */
export function to24Hours(hours: number, meridiem: Meridiem): number {
  if (meridiem === 'AM') {
    return hours === 12 ? 0 : hours;
  }

  return hours === 12 ? 12 : hours + 12;
}

/**
 * Читает время из текста. Точность поля разбор не урезает: `14:30:15.250` в `HH:mm`
 * даёт секунды и миллисекунды, чтобы скрытая точность не терялась при правке.
 * Формат на разбор не влияет и остаётся в сигнатуре ради API; цикл часов тоже:
 * меридием понимается в обоих циклах.
 */
export function parseView(view: string, _format: TimeFormat, _cycle: HourCycle): TimeValue | null {
  const text = normalizeForParse(view);

  if (text.length === 0) {
    return null;
  }

  const direct = readToken(text);

  if (direct.matched) {
    return direct.value;
  }

  const candidates = text.match(IN_TEXT);

  if (candidates === null || candidates.length !== 1) {
    return null;
  }

  return readToken(candidates[0]).value;
}

/**
 * Дочитывает недонабранное время по blur: `12` — это `12:00`, `9` — `09:00`.
 * Полный разбор важнее: всё, что понимает `parseView`, возвращается как есть.
 */
export function completeView(view: string, format: TimeFormat, cycle: HourCycle): TimeValue | null {
  const text = normalizeForParse(view);
  const direct = parseView(text, format, cycle);

  if (direct !== null) {
    return direct;
  }

  const match = HOURS_ONLY.exec(text.replace(/[:.,\-\s]+$/, ''));

  if (match?.groups === undefined) {
    return null;
  }

  const hours = Number(match.groups['hours']);
  const meridiem = match.groups['meridiem']?.toUpperCase() as Meridiem | undefined;
  const value = meridiem === undefined ? hours : to24Hours(hours, meridiem);

  if (hours > 23 || value > 23) {
    return null;
  }

  return { hours: value, minutes: 0, seconds: 0, milliseconds: 0 };
}

/**
 * Вставка нормализуется всегда: края обрезаются, любые пробелы и переводы строк
 * схлопываются в один пробел. Если в тексте однозначно читается время, в поле
 * попадает только оно, остальное отбрасывается; иначе текст вставляется как есть.
 */
export function pasteOutcome(text: string, format: TimeFormat, cycle: HourCycle): PasteOutcome {
  const normalized = normalizeForParse(text);
  const value = parseView(normalized, format, cycle);

  return value === null ? { kind: 'as-is', text: normalized } : { kind: 'recognized', value };
}

function readToken(text: string): Attempt {
  const plain = DIGITS.exec(text);

  if (plain !== null) {
    return { matched: true, value: fromDigits(plain[1], plain[2]) };
  }

  for (const pattern of GROUPED) {
    const match = pattern.exec(text);

    if (match !== null) {
      const parts = rawParts(match);

      return { matched: true, value: parts === null ? null : toValue(parts) };
    }
  }

  return { matched: false, value: null };
}

/**
 * Слитные цифры читаются с той точностью, сколько в них групп: 4 — часы и минуты,
 * 6 — с секундами, 9 — с миллисекундами. Формат на это не влияет: лишняя точность
 * сохраняется скрыто, как и при записи с разделителями.
 * Другая длина без разделителей неоднозначна и не читается.
 */
function fromDigits(digits: string, meridiem: string | undefined): TimeValue | null {
  const meridiemOf = toMeridiem(meridiem);

  if (digits.length === 4) {
    return toValue({
      hours: digits.slice(0, 2),
      minutes: digits.slice(2),
      meridiem: meridiemOf,
    });
  }

  if (digits.length === 6) {
    return toValue({
      hours: digits.slice(0, 2),
      minutes: digits.slice(2, 4),
      seconds: digits.slice(4),
      meridiem: meridiemOf,
    });
  }

  if (digits.length === 9) {
    return toValue({
      hours: digits.slice(0, 2),
      minutes: digits.slice(2, 4),
      seconds: digits.slice(4, 6),
      milliseconds: digits.slice(6),
      meridiem: meridiemOf,
    });
  }

  return null;
}

/** Части читаются по именам групп: `pm` из пробельной записи больше не попадает в миллисекунды. */
function rawParts(match: RegExpMatchArray): RawParts | null {
  const groups = match.groups as Partial<Record<keyof RawParts, string>> | undefined;
  const hours = groups?.['hours'];
  const minutes = groups?.['minutes'];

  if (hours === undefined || minutes === undefined) {
    return null;
  }

  return {
    hours,
    minutes,
    seconds: groups?.['seconds'],
    milliseconds: groups?.['milliseconds'],
    meridiem: toMeridiem(groups?.['meridiem']),
  };
}

function toValue(parts: RawParts): TimeValue | null {
  const hours = Number(parts.hours);
  const minutes = Number(parts.minutes);
  const seconds = parts.seconds === undefined ? 0 : Number(parts.seconds);
  const milliseconds =
    parts.milliseconds === undefined ? 0 : Number(parts.milliseconds.padEnd(3, '0'));

  const hours24 =
    parts.meridiem === undefined
      ? hours <= 23
        ? hours
        : null
      : hours >= 1 && hours <= 12
        ? to24Hours(hours, parts.meridiem)
        : null;

  if (hours24 === null || minutes > 59 || seconds > 59) {
    return null;
  }

  return { hours: hours24, minutes, seconds, milliseconds };
}

function toMeridiem(text: string | undefined): Meridiem | undefined {
  return text === undefined ? undefined : (text.toUpperCase() as Meridiem);
}
