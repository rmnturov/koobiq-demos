import { Component, importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';
import { DateAdapter } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqTimepickerModule } from '@koobiq/components/timepicker';
import { OLD_EMPTY, OldState, oldBlur, oldPaste, oldStep, oldType } from './old-field';

/**
 * Разметка как в демо: значение ходит через форму, а не через `[value]`. Счетчик на `incorrectInput` —
 * тоже как в демо: панель зажигает «Только цифры» именно по этому выходу, а не по своему состоянию.
 */
@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, KbqTimepickerModule],
  template: `
    <kbq-form-field>
      <input kbqTimepicker [formControl]="control" (incorrectInput)="incorrect = incorrect + 1" />
    </kbq-form-field>
  `,
})
class Host {
  readonly control = new FormControl<Date | null>(null);
  incorrect: number = 0;
}

interface RealField {
  fixture: ComponentFixture<Host>;
  input: HTMLInputElement;
}

/** Коды клавиш: директива читает `event.keyCode`, а синтетическое событие без него отдает 0. */
const KEY_CODES: Record<string, number> = { ':': 186, ' ': 32, ArrowUp: 38, ArrowDown: 40 };

const keyCodeOf = (key: string): number => KEY_CODES[key] ?? key.toUpperCase().charCodeAt(0);

/** Директива правит вид в `setTimeout`, а выделение сегмента ставит еще одним — ждем оба. */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 3; tick++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Настоящий контрол: тот же набор событий, что получает модель. */
async function realField(): Promise<RealField> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [importProvidersFrom(KbqLuxonDateModule)],
  });

  const fixture = TestBed.createComponent(Host);

  fixture.detectChanges();
  await fixture.whenStable();

  const input: HTMLInputElement = fixture.nativeElement.querySelector('input');

  input.focus();
  fixture.detectChanges();

  return { fixture, input };
}

/**
 * Символ, набранный в поле: `keydown`, а если директива его не погасила — вставка, которую делает
 * браузер. jsdom нативной вставки не делает, поэтому ее повторяем сами.
 */
async function typeChar(field: RealField, char: string): Promise<void> {
  const keydown = new KeyboardEvent('keydown', {
    key: char,
    keyCode: keyCodeOf(char),
    bubbles: true,
    cancelable: true,
  });

  field.input.dispatchEvent(keydown);

  if (!keydown.defaultPrevented) {
    const start = field.input.selectionStart ?? 0;
    const end = field.input.selectionEnd ?? 0;

    field.input.value = field.input.value.slice(0, start) + char + field.input.value.slice(end);
    field.input.setSelectionRange(start + char.length, start + char.length);
    field.input.dispatchEvent(new Event('input'));
  }

  await settle();
  field.fixture.detectChanges();
}

async function typeText(field: RealField, text: string): Promise<void> {
  for (const char of text) await typeChar(field, char);
}

async function press(field: RealField, key: string, init: KeyboardEventInit = {}): Promise<void> {
  field.input.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      keyCode: keyCodeOf(key),
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );

  await settle();
  field.fixture.detectChanges();
}

async function blur(field: RealField): Promise<void> {
  field.input.dispatchEvent(new Event('blur'));
  await settle();
  field.fixture.detectChanges();
}

/**
 * Подмена `DataTransfer`: в jsdom нет ни `DataTransfer`, ни `ClipboardEvent` (у обоих `typeof` —
 * `undefined`), поэтому событие пасты собирается из обычного `Event`. Хранилище повторяет
 * браузерное правило «`text` — псевдоним `text/plain`»: директива читает именно `getData('text')`.
 */
function pasteEvent(text: string): Event {
  const store = new Map([['text/plain', text]]);
  const clipboardData = {
    getData: (format: string): string => store.get(format === 'text' ? 'text/plain' : format) ?? '',
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clipboardData', { value: clipboardData });

  return event;
}

/** Вставка заменяет поле целиком, поэтому набор не нужен: только пустое поле и событие пасты. */
async function realFieldAfterPaste(text: string): Promise<RealField> {
  const field = await realField();

  field.input.dispatchEvent(pasteEvent(text));
  await settle();
  field.fixture.detectChanges();

  return field;
}

const twoDigits = (value: number): string => `${value}`.padStart(2, '0');

/**
 * Значение формы настоящего контрола в том же виде, в каком его держит модель.
 *
 * Директива отдает в форму Luxon `DateTime`, хотя тип контрола — `Date`, поэтому часы и минуты
 * читаются адаптером: подпись «значение подменено / не тронуто» получает то же число, что и форма.
 */
function controlValue(field: RealField): string | null {
  const value = field.fixture.componentInstance.control.value;

  if (!value) {
    return null;
  }

  const adapter = TestBed.inject(DateAdapter);

  return `${twoDigits(adapter.getHours(value))}:${twoDigits(adapter.getMinutes(value))}`;
}

/** Сколько отказов директива отдала наружу: по этому счетчику панель и держит «Только цифры». */
const refusalCount = (field: RealField): number => field.fixture.componentInstance.incorrect;

/**
 * Обе подписи панели сверяются с настоящим контролем: вид — с полем, значение — с формой, а флаг
 * отказа — с выходом `incorrectInput`, а не с самим собой.
 */
function expectSameAsControl(field: RealField, model: OldState, refusals: number): void {
  expect(model.view).toBe(field.input.value);
  expect(model.value).toEqual(controlValue(field));
  expect(Number(model.rejected)).toBe(refusals);
}

/** Состояние заполненного поля: одна и та же запись нужна стрелкам и blur. */
const filled = (view: string, caret = view.length): OldState => ({
  view,
  value: view,
  caret,
  rejected: false,
});

describe('old timepicker model: typing', () => {
  /**
   * Замер настоящего поля: символы набираются подряд, начиная с пустого поля. `refusals` — прирост
   * `incorrectInput` на этом шаге.
   */
  const typed: { char: string; view: string; value: string | null; refusals: number }[] = [
    // Недобранные часы в форму не уходят: значение появляется только на второй цифре.
    { char: '2', view: '2', value: null, refusals: 0 },
    { char: '5', view: '23:00', value: '23:00', refusals: 0 },
    // Разделитель в выделенном сегменте директива не вставляет и сообщает об отказе.
    { char: ':', view: '23:00', value: '23:00', refusals: 1 },
    // Недобранные минуты вид меняют, а значение формы — нет.
    { char: '8', view: '23:8', value: '23:00', refusals: 0 },
    { char: '8', view: '23:59', value: '23:59', refusals: 0 },
  ];

  it('writes characters in the same order as the real control', async () => {
    const field = await realField();
    let model = OLD_EMPTY;

    for (const row of typed) {
      const refusalsBefore = refusalCount(field);

      model = oldType(model, row.char);
      await typeChar(field, row.char);

      // Таблица — это замер настоящего поля; модель обязана совпасть и с ней, и с полем.
      expect([row.char, field.input.value, controlValue(field)]).toEqual([
        row.char,
        row.view,
        row.value,
      ]);
      expect([row.char, refusalCount(field) - refusalsBefore]).toEqual([row.char, row.refusals]);
      expectSameAsControl(field, model, refusalCount(field) - refusalsBefore);
    }
  });

  it('keeps an incomplete view out of the form value', async () => {
    const field = await realField();
    let model = OLD_EMPTY;

    for (const char of ['2', '5', '8']) {
      model = oldType(model, char);
      await typeChar(field, char);
    }

    // Главный случай подмены: вид уже `23:8`, а значение формы прежнее. Модель, бравшая `value` из
    // вида, показала бы панели «значение подменено» на ровном месте.
    expect([field.input.value, controlValue(field)]).toEqual(['23:8', '23:00']);
    expect([model.view, model.value]).toEqual(['23:8', '23:00']);
  });

  it('clamps hours to 23 on the second digit', async () => {
    expect(oldType(oldType(OLD_EMPTY, '2'), '5').value).toBe('23:00');
  });

  it('completes the hours segment once two digits are typed', async () => {
    expect(oldType(oldType(OLD_EMPTY, '1'), '4').value).toBe('14:00');
  });

  it('rejects a letter the way the control does', async () => {
    const field = await realField();
    await typeText(field, '0230');

    const refusalsBefore = refusalCount(field);
    const model = oldType(filled('02:30', 3), 'p');

    await typeChar(field, 'p');

    expect([field.input.value, controlValue(field)]).toEqual(['02:30', '02:30']);
    // Буква — тот случай, когда директива гасит клавишу и отдает `incorrectInput` ровно один раз.
    expect([refusalCount(field) - refusalsBefore, model.rejected]).toEqual([1, true]);
    expectSameAsControl(field, model, 1);
  });

  it('completes an incomplete value on blur', async () => {
    expect(oldBlur({ view: '12', value: null, caret: 2, rejected: false }).view).toBe('12:00');

    // '12' в настоящем поле не удержать: вторая цифра сразу доводит часы до '12:00'. Замер поэтому
    // берется на недобранных минутах — единственном виде, который директива оставляет до blur.
    const field = await realField();
    await typeText(field, '23');
    await typeChar(field, '8');
    expect(field.input.value).toBe('23:8');

    const refusalsBefore = refusalCount(field);
    const model = oldBlur({ view: '23:8', value: '23:00', caret: 4, rejected: false });

    await blur(field);

    expect([field.input.value, controlValue(field)]).toEqual(['23:08', '23:08']);
    expectSameAsControl(field, model, refusalCount(field) - refusalsBefore);
  });

  it('keeps a two-digit value that is already canonical', async () => {
    expect(oldBlur(filled('14:30')).view).toBe('14:30');

    const field = await realField();
    await typeText(field, '1430');

    const refusalsBefore = refusalCount(field);
    const model = oldBlur(filled('14:30'));

    await blur(field);

    expect([field.input.value, controlValue(field)]).toEqual(['14:30', '14:30']);
    expectSameAsControl(field, model, refusalCount(field) - refusalsBefore);
  });

  it('drops a rejection the control no longer reports on blur', async () => {
    const field = await realField();
    await typeText(field, '0230');
    await typeChar(field, 'p');

    const refusalsBefore = refusalCount(field);
    const model = oldBlur({ view: '02:30', value: '02:30', caret: 3, rejected: true });

    await blur(field);

    // Вид и значение уже совпадают: директива ничего не пересобирает и молчит, значит и флаг снят.
    expect([refusalCount(field) - refusalsBefore, model.rejected]).toEqual([0, false]);
    expectSameAsControl(field, model, 0);
  });
});

describe('old timepicker model: space', () => {
  it('finishes a single digit with a space like a divider', async () => {
    const field = await realField();
    await typeText(field, '2');

    const refusalsBefore = refusalCount(field);
    const model = oldType(oldType(OLD_EMPTY, '2'), ' ');

    await typeChar(field, ' ');

    // Пробел после одной цифры директива гоняет через `replaceSymbols`, как двоеточие: `'2 '` → `02:00`.
    expect([field.input.value, controlValue(field)]).toEqual(['02:00', '02:00']);
    expect([refusalCount(field) - refusalsBefore, model.rejected]).toEqual([0, false]);
    expectSameAsControl(field, model, 0);
  });

  it('ignores a space that changes nothing and stays silent', async () => {
    const field = await realField();
    await typeText(field, '0230');
    field.input.setSelectionRange(4, 4);

    const refusalsBefore = refusalCount(field);
    const model = oldType(filled('02:30', 4), ' ');

    await typeChar(field, ' ');

    // `spaceKeyHandler()` в этой ветке не эмитит `incorrectInput`: панель не должна показывать
    // «Только цифры» там, где настоящий контрол молчит.
    expect([field.input.value, controlValue(field)]).toEqual(['02:30', '02:30']);
    expect([refusalCount(field) - refusalsBefore, model.rejected]).toEqual([0, false]);
    expectSameAsControl(field, model, 0);

    // Пустое поле — тот же случай: пробел ничего не меняет и ни о чем не сообщает.
    const empty = await realField();

    await typeChar(empty, ' ');

    expect([empty.input.value, controlValue(empty)]).toEqual(['', null]);
    expect([refusalCount(empty), oldType(OLD_EMPTY, ' ')]).toEqual([0, OLD_EMPTY]);
  });

  it('moves a selected segment on with a space', async () => {
    const field = await realField();
    await typeText(field, '0230');

    const refusalsBefore = refusalCount(field);
    // В модели «каретка на начале сегмента» и означает «сегмент выделен».
    let model = oldType(filled('02:30', 3), ' ');

    await typeChar(field, ' ');

    expect(field.input.selectionStart).toBe(0);
    expect([model.view, model.value, model.caret]).toEqual([
      '02:30',
      '02:30',
      field.input.selectionStart,
    ]);

    model = oldType(model, ' ');

    await typeChar(field, ' ');

    expect(field.input.selectionStart).toBe(3);
    expect([model.view, model.value, model.caret]).toEqual([
      '02:30',
      '02:30',
      field.input.selectionStart,
    ]);
    expect([refusalCount(field) - refusalsBefore, model.rejected]).toEqual([0, false]);
    expectSameAsControl(field, model, 0);
  });
});

describe('old timepicker model: paste', () => {
  /**
   * Таблица брифа целиком, плюс три замеренные строки, которых в ней нет: «12:30 am» и «12:30 pm»
   * директива одинаково перекатывает через сутки в `00:30`, без пробела перед `pm` разбор AM/PM не
   * срабатывает (`2:30pm` — это `02:30`), а перевод строки между цифрами директива успевает разобрать
   * как разделитель, поэтому склейка вида происходит уже после разбора.
   *
   * Последняя строка — контрольный замер со страницы: та же склейка без перевода строки разбирается
   * сразу, минуты поджимаются к `59`, и в поле оказывается `14:59` без всякого ухода фокуса.
   */
  const pasted: [text: string, view: string, value: string | null][] = [
    ['встреча в 15:30', '15:30', '15:30'],
    ['1430', '23:00', '23:00'],
    ['14-16', '14:16', '14:16'],
    ['12.05.2025', '12:05', '12:05'],
    ['https://example.com/74-169/', '23:59', '23:59'],
    ['abc123', '23:00', '23:00'],
    ['25:99', '23:59', '23:59'],
    ['14:30\n15:00', '14:3015:00', null],
    ['14:30', '14:30', '14:30'],
    ['2:30 pm', '14:30', '14:30'],
    ['12:30 am', '00:30', '00:30'],
    ['2:30pm', '02:30', '02:30'],
    ['1\n2', '01:02', '01:02'],
    ['14:3015:00', '14:59', '14:59'],
  ];

  it.each(pasted)('pastes %s as %s', async (text, view, value) => {
    const field = await realFieldAfterPaste(text);
    const model = oldPaste(text);

    // Таблица — это замер настоящего поля; модель обязана совпасть и с ней, и с полем.
    expect([text, field.input.value, controlValue(field)]).toEqual([text, view, value]);
    expect(model).toMatchObject({ view, value });
    expectSameAsControl(field, model, refusalCount(field));
    // Вставка заменяет поле целиком — каретка встает в конец, как и в настоящем контроле.
    expect(model.caret).toBe(field.input.selectionStart);
  });

  it('keeps the field untouched on an empty paste', async () => {
    const model = oldPaste('   ');

    expect(model.value).toBeNull();
    expect(oldPaste('').value).toBeNull();

    // Вид повторяет настоящий контрол: пробелы он оставляет в поле как есть.
    const field = await realFieldAfterPaste('   ');

    expect([model.view, field.input.value, controlValue(field)]).toEqual(['   ', '   ', null]);
    expectSameAsControl(field, model, refusalCount(field));
  });

  it('rewrites the glued digits of a two-line paste on blur', async () => {
    const field = await realFieldAfterPaste('14:30\n15:00');

    // До ухода фокуса поле держит склейку, а форма пуста — это уже закреплено таблицей выше.
    expect([field.input.value, controlValue(field)]).toEqual(['14:3015:00', null]);

    const refusalsBefore = refusalCount(field);
    const model = oldBlur(oldPaste('14:30\n15:00'));

    await blur(field);

    // Замер со страницы: `formatUserPaste` собирает группы `14`, `3015`, `00`, минуты поджимаются к
    // `59`, и по уходу фокуса в поле с формой стоит `14:59` — то же, что при вставке склейки целиком.
    expect([field.input.value, controlValue(field)]).toEqual(['14:59', '14:59']);
    expectSameAsControl(field, model, refusalCount(field) - refusalsBefore);
  });
});

describe('old timepicker model: arrows', () => {
  it('steps minutes by one without Shift', async () => {
    expect(oldStep(filled('14:30', 4), 'minutes', 1, false).view).toBe('14:31');

    const field = await realField();
    await typeText(field, '1430');
    field.input.setSelectionRange(4, 4);

    const refusalsBefore = refusalCount(field);
    const model = oldStep(filled('14:30', 4), 'minutes', 1, false);

    await press(field, 'ArrowUp');

    expect([field.input.value, controlValue(field)]).toEqual(['14:31', '14:31']);
    expectSameAsControl(field, model, refusalCount(field) - refusalsBefore);
  });

  it('ignores the arrow with Shift and drops the rejection', async () => {
    const field = await realField();
    await typeText(field, '1430');
    await typeChar(field, 'p');
    field.input.setSelectionRange(4, 4);

    const refusalsBefore = refusalCount(field);
    const model = oldStep(
      { view: '14:30', value: '14:30', caret: 4, rejected: true },
      'minutes',
      1,
      true,
    );

    await press(field, 'ArrowUp', { shiftKey: true });

    // Shift+стрелка для директивы — движение по полю: ни шага, ни `incorrectInput`, ни отказа.
    expect([field.input.value, controlValue(field)]).toEqual(['14:30', '14:30']);
    expect([refusalCount(field) - refusalsBefore, model.rejected]).toEqual([0, false]);
    expectSameAsControl(field, model, 0);
  });

  it('drops the rejection on an arrow that steps the time', async () => {
    const field = await realField();
    await typeText(field, '0230');
    await typeChar(field, 'p');
    field.input.setSelectionRange(4, 4);

    const refusalsBefore = refusalCount(field);
    const model = oldStep(
      { view: '02:30', value: '02:30', caret: 3, rejected: true },
      'minutes',
      1,
      false,
    );

    await press(field, 'ArrowUp');

    expect([field.input.value, controlValue(field)]).toEqual(['02:31', '02:31']);
    expect([refusalCount(field) - refusalsBefore, model.rejected]).toEqual([0, false]);
    expectSameAsControl(field, model, 0);
  });

  it('wraps hours from 23 to 00', async () => {
    expect(oldStep(filled('23:30', 1), 'hours', 1, false).view).toBe('00:30');

    const field = await realField();
    await typeText(field, '2330');
    field.input.setSelectionRange(1, 1);

    const refusalsBefore = refusalCount(field);
    const model = oldStep(filled('23:30', 1), 'hours', 1, false);

    await press(field, 'ArrowUp');

    expect([field.input.value, controlValue(field)]).toEqual(['00:30', '00:30']);
    expectSameAsControl(field, model, refusalCount(field) - refusalsBefore);
  });

  it('wraps hours back from 00 to 23', async () => {
    expect(oldStep(filled('00:30', 1), 'hours', -1, false).view).toBe('23:30');

    const field = await realField();
    await typeText(field, '0030');
    field.input.setSelectionRange(1, 1);

    const refusalsBefore = refusalCount(field);
    const model = oldStep(filled('00:30', 1), 'hours', -1, false);

    await press(field, 'ArrowDown');

    expect([field.input.value, controlValue(field)]).toEqual(['23:30', '23:30']);
    expectSameAsControl(field, model, refusalCount(field) - refusalsBefore);
  });

  it('leaves an empty field alone', async () => {
    expect(oldStep(OLD_EMPTY, 'hours', 1, false)).toBe(OLD_EMPTY);
    // Пустое поле флаг отказа тоже не держит: директива выходит до любых изменений и молчит.
    expect(oldStep({ ...OLD_EMPTY, rejected: true }, 'hours', 1, false)).toMatchObject({
      view: '',
      value: null,
      rejected: false,
    });

    const field = await realField();
    await press(field, 'ArrowUp');

    expect([field.input.value, controlValue(field)]).toEqual(['', null]);
  });
});
