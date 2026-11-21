/**
 * Кейсы страницы сравнения: что делает пользователь, что получается на текущем `KbqTimepicker` и что —
 * на новом поле.
 *
 * Исходы слева замерены на живом контроле и записаны в
 * `docs/superpowers/specs/2026-11-10-timepicker-compare-design.md` (раздел «Замеры»), исходы справа —
 * прогоном моделей `models/old-field.ts` и `models/new-field.ts`. Здесь только данные: страница
 * проигрывает действие из `action`, начиная с `from`, и показывает `old`/`next` как конечное
 * состояние. Расхождение модели с этими ожиданиями — повод перепроверить, а не поправить таблицу
 * на глаз.
 */

import { HourCycle, TimeFormat } from '../timepicker/time-input/time-input.types';

/** Секция страницы: ввод с клавиатуры или вставка из буфера. */
export type CaseSection = 'type' | 'paste';

/** Действие, которое проигрывает мультик на обеих сторонах. */
export type CaseAction =
  /** Набор текста по символу. */
  | { kind: 'type'; text: string }
  /** Вставка из буфера одним куском. */
  | { kind: 'paste'; text: string }
  /**
   * Стрелка по сегменту; `shift` — крупный шаг. `times` — сколько нажатий подряд,
   * `back` — столько же обратных: сценарий читается как «прошагал и вернул».
   */
  | { kind: 'key'; key: 'ArrowUp'; shift: boolean; times?: number; back?: boolean };

/** Конечное состояние одной стороны: вид в поле, значение формы и подпись распознавания. */
export interface CaseOutcome {
  /** Что видно в поле. */
  view: string;
  /** Значение формы — `HH:mm` — или null, пока время не распознано. */
  value: string | null;
  /** Тултип распознавания: заполнен там, где модель его ставит. */
  recognized?: string;
}

/** Один кейс сравнения. */
export interface CompareCase {
  /** Идентификатор для разметки и тестов; совпадает с порядком в спеке. */
  id: string;
  /** Секция страницы. */
  section: CaseSection;
  /** Что делает пользователь — заголовок пары. */
  title: string;
  /**
   * Ярлык для оглавления: голое значение вместо фразы заголовка. Нужен там, где хвост
   * заголовка стоит в косвенном падеже («Вставка даты 12.05.2025» — «12.05.2025»).
   * Без него оглавление показывает заголовок без слова секции.
   */
  toc?: string;
  /** Действие мультика. */
  action: CaseAction;
  /** Точность поля: свойство кейса, а не страницы. */
  format: TimeFormat;
  /** Цикл часов: свойство кейса, а не страницы. */
  cycle: HourCycle;
  /**
   * С какого состояния начинается мультик: для стрелок — заполненное поле.
   *
   * Соглашение о каретке: поле заполнено, каретка стоит в конце вида — так её оставляют и `newPaste`,
   * и `oldPaste`. Из этого следует, что стрелка шагает последний сегмент вида (в `HH:mm` — минуты):
   * `newStep` берёт сегмент из каретки, а не из `action`. Без этого `shift-step` дал бы `00:30`
   * вместо `14:40`.
   */
  from: CaseOutcome | null;
  /** Исход слева, на текущем `KbqTimepicker`. */
  old: CaseOutcome;
  /** Исход справа, на новом поле. */
  next: CaseOutcome;
  /** Одна строка факта под панелью. */
  caption: { old: string; next: string };
  /**
   * Абзац перед сравнением — markdown-строка между строкой точности и парой. Нужен там,
   * где подпись под панелью объясняет исход, но не объясняет, откуда он взялся.
   * Необязателен: у большинства кейсов объяснять нечего.
   */
  note?: string;
  /**
   * Пара «где разницы нет»: обе стороны дают один исход. Страница по этой пометке
   * выносит кейс в отдельную секцию, поэтому она живёт в данных: список id на странице
   * молча терял кейс при переименовании.
   */
  noDiff?: true;
}

/** Точность по умолчанию: другой точности старый контрол в демо не показывает. */
const FORMAT: TimeFormat = 'HH:mm';

/** Цикл по умолчанию: 12 часов только у кейса с меридиемом. */
const CYCLE: HourCycle = 'h23';

/** Время `14:30` в любой записи (`1430`, `14:30`, `2:30 pm`) новое поле распознает: вид `14:30`, тултип «Распознано как 14:30». */
const RECOGNIZED_1430 = 'Распознано как 14:30';

/** Дефис у нового поля такой же разделитель, как двоеточие, поэтому `14-16` — это `14:16`. */
const RECOGNIZED_1416 = 'Распознано как 14:16';

/**
 * Кейсы в порядке страницы: сначала ввод с клавиатуры, затем вставка. Пары «где разницы нет»
 * (`range`, `clean`, `meridiem-paste`) стоят в конце секции вставки: страница, которая показывает
 * только проигрыши нынешнего контрола, читается как реклама.
 */
export const CASES: readonly CompareCase[] = [
  {
    id: 'range-typing',
    section: 'type',
    title: 'Набрать 25:88',
    note: 'Заведомо невалидное значение времени, разные стратегии обработки этой ситуации.',
    action: { kind: 'type', text: '25:88' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    old: { view: '23:59', value: '23:59' },
    next: { view: '25:08', value: null },
    caption: {
      old: '❌ Значения поджаты к максимуму',
      // Подпись повторяет вид в поле, а не буфер: вторая цифра минут в заполненный сегмент не входит,
      // поэтому набранные `25:88` видны как `25:08`.
      next: '🤔 Ввод без изменений, ошибка по расфокусу',
    },
  },
  {
    id: 'shift-step',
    section: 'type',
    title: 'Shift + ↑ на минутах',
    /*
     * Три шага вверх и три обратно: поле возвращается в исходное, видно только движение.
     * Отсчет от 14:00, а не от 14:30: у нового поля минуты шагают без переноса часа,
     * и серия с 14:50 ушла бы в 14:00 — не тот сюжет, который обещает заголовок.
     */
    note: 'Поддержка увеличенного шага в степпере, может ли поле в ускоренном режиме менять значения по Shift+·↑↓.',
    action: { kind: 'key', key: 'ArrowUp', shift: true, times: 3, back: true },
    format: FORMAT,
    cycle: CYCLE,
    from: { view: '14:00', value: '14:00' },
    old: { view: '14:00', value: '14:00' },
    next: { view: '14:00', value: '14:00' },
    caption: {
      old: '❌ Только увеличение на 1',
      next: '✅ Большой шаг по 10',
    },
  },
  {
    id: 'meridiem-typing',
    section: 'type',
    title: 'Набрать 02:30 и p',
    note: 'Ввод времени с AM/PM в поле c форматом 24 часов.',
    action: { kind: 'type', text: '02:30p' },
    format: FORMAT,
    cycle: 'h12',
    from: null,
    old: { view: '02:30', value: '02:30' },
    next: { view: '02:30 PM', value: '14:30' },
    caption: {
      old: '🐤 Зря поле ругается на двоеточие',
      next: '✅ Все тип-топ',
    },
  },
  {
    id: 'sentence',
    section: 'paste',
    title: 'Вставка «встреча в 15:30»',
    // В оглавлении кавычки не нужны: строка и так читается как текст вставки.
    toc: 'Встреча в 15:30',
    note: 'Распознать однозначно указанное в тексте время могут оба контрола.',
    action: { kind: 'paste', text: 'встреча в 15:30' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    old: { view: '15:30', value: '15:30' },
    next: { view: '15:30', value: '15:30', recognized: 'Распознано как 15:30' },
    caption: {
      old: '✅ Текст молча отброшен',
      next: '✅ Поле сообщает о преобразовании',
    },
  },
  {
    id: 'digits',
    section: 'paste',
    title: 'Вставка 1430',
    note: 'Четыре цифры без разделителя: Кубик берет их одним числом часов и поджимает к суткам, поэтому 1430 превращается в 23:00. Новое поле видит в них часы и минуты, получает 14:30 и сообщает о прочтении подсказкой.',
    action: { kind: 'paste', text: '1430' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    old: { view: '23:00', value: '23:00' },
    next: { view: '14:30', value: '14:30', recognized: RECOGNIZED_1430 },
    caption: {
      old: '❌ Вставка воспринимается одним числом, контрол поджимает к макс. значению часов',
      next: '✅ Распознано как 14:30',
    },
  },
  {
    id: 'date',
    section: 'paste',
    title: 'Вставка даты 12.05.2025',
    toc: '12.05.2025',
    note: 'Строка которая состоит и цифр и разделителей, фразметнарно даже может походить на завись времени, но им не является: дата, IP-адрес, код доступа и тп.',
    action: { kind: 'paste', text: '12.05.2025' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    old: { view: '12:05', value: '12:05' },
    next: { view: '12.05.2025', value: null },
    caption: {
      old: '❌ Из даты поле сделало время',
      next: '🤔 Вставлено как есть, по выходу будет ошибка',
    },
  },
  {
    id: 'url',
    section: 'paste',
    title: 'Вставка ссылки',
    toc: 'Ссылка',
    note: 'В буфера обмена может оказаться URl, в котором есть цифры.',
    action: { kind: 'paste', text: 'https://example.com/74-169/' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    old: { view: '23:59', value: '23:59' },
    next: { view: 'https://example.com/74-169/', value: null },
    caption: {
      old: '❌ Поле неожиданно преобразовало URL во время',
      next: '🤔 Вставлено как есть, по выходу будет ошибка',
    },
  },
  {
    id: 'junk',
    section: 'paste',
    title: 'Вставка артикула abc123',
    toc: 'abc123',
    action: { kind: 'paste', text: 'abc123' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    old: { view: '23:00', value: '23:00' },
    next: { view: 'abc123', value: null },
    caption: {
      old: '❌ Непредсказуемое преобразование',
      next: '🤔 Вставлено как есть, по выходу будет ошибка',
    },
  },
  {
    id: 'invalid',
    section: 'paste',
    title: 'Вставка 25:99',
    action: { kind: 'paste', text: '25:99' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    old: { view: '23:59', value: '23:59' },
    next: { view: '25:99', value: null },
    caption: {
      old: '❌ Часы и минуты имеют макс. значения',
      next: '🤔 Вставлено как есть, по выходу будет ошибка',
    },
  },
  {
    id: 'multiline',
    section: 'paste',
    title: 'Вставка двух строк 14:30⏎15:00',
    toc: '14:30⏎15:00',
    action: { kind: 'paste', text: '14:30\n15:00' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    // Исход — уже после ухода фокуса: без него в поле осталась бы склейка `14:3015:00`, а в форме
    // пусто. По blur директива доводит вид через `formatUserPaste` и поджимает слипшиеся минуты.
    old: { view: '14:59', value: '14:59' },
    next: { view: '14:30 15:00', value: null },
    caption: {
      old: '14:59 — слипшиеся 14:3015:00 переписаны по blur',
      next: '14:30 15:00 — строки схлопнуты в пробел, ошибка по blur',
    },
  },
  {
    id: 'range',
    section: 'paste',
    title: 'Вставка 14-16',
    action: { kind: 'paste', text: '14-16' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    noDiff: true,
    old: { view: '14:16', value: '14:16' },
    next: { view: '14:16', value: '14:16', recognized: RECOGNIZED_1416 },
    caption: {
      old: '✅ Дефис молча преобразован',
      next: '✅ Дефис разобран. Поле сообщает о преобразовании',
    },
  },
  {
    id: 'clean',
    section: 'paste',
    title: 'Вставка 14:30',
    action: { kind: 'paste', text: '14:30' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    noDiff: true,
    old: { view: '14:30', value: '14:30' },
    next: { view: '14:30', value: '14:30', recognized: RECOGNIZED_1430 },
    caption: {
      old: '✅ По-другому быть не могло',
      next: '✅ По-другому быть не могло',
    },
  },
  {
    id: 'meridiem-paste',
    section: 'paste',
    title: 'Вставка 2:30 pm',
    action: { kind: 'paste', text: '2:30 pm' },
    format: FORMAT,
    cycle: CYCLE,
    from: null,
    noDiff: true,
    old: { view: '14:30', value: '14:30' },
    next: { view: '14:30', value: '14:30', recognized: RECOGNIZED_1430 },
    caption: {
      old: '✅ Время после полудня преобразовано',
      next: '✅ Время после полудня преобразовано',
    },
  },
];

/** Ярлык ссылки в оглавлении: явный или заголовок без слова секции. */
export const tocLabelOf = (item: CompareCase): string =>
  // В оглавлении нет слов секции: пункт называет сам текст, а не действие над ним.
  item.toc ?? item.title.replace(/^(Вставка|Набрать)\s+/, '');

/** Кейсы одной секции в объявленном порядке. */
export const casesOf = (section: CaseSection): readonly CompareCase[] =>
  CASES.filter((item) => item.section === section);
