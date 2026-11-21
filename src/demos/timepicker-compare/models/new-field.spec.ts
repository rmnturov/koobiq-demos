import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { TimeInputDirective } from '../../timepicker/time-input/time-input.directive';
import { HourCycle, TimeFormat } from '../../timepicker/time-input/time-input.types';
import { NewState, newBlur, newEmpty, newPaste, newStep, newType } from './new-field';

const FORMAT: TimeFormat = 'HH:mm';
const CYCLE: HourCycle = 'h23';

/** Текст ошибки разбора, который директива отдает `errorText()` в формате `HH:mm`. */
const ERROR_TEXT = 'Введите время в формате ЧЧ:ММ, например 14:30';

/**
 * Набор строки с пустого поля. Типы параметров заданы явно: в снипете брифа умолчания через
 * `as const` сужали `cycle` до `'h23'` и 12-часовой вызов не собирался.
 */
const typeAll = (text: string, format: TimeFormat = FORMAT, cycle: HourCycle = CYCLE) =>
  [...text].reduce((state, char) => newType(state, char, format, cycle), newEmpty(format, cycle));

describe('new field model', () => {
  it('keeps an out-of-range hour as typed', () => {
    const state = newBlur(typeAll('25:88'), 'HH:mm', 'h23');

    // Замер настоящего поля: минуты маска достраивает нулём (`8` — это `08`), а вторая восьмёрка
    // в заполненный сегмент не попадает. Час `25` в поле остается как набран.
    expect(state.view).toBe('25:08');
    expect(state.value).toBeNull();
    expect(state.error).toBe('Введите время в формате ЧЧ:ММ, например 14:30');
  });

  it('reads a meridiem letter in the 12-hour cycle', () => {
    expect(typeAll('02:30p', 'HH:mm', 'h12')).toMatchObject({ view: '02:30 PM', value: '14:30' });
  });

  it('steps the selected segment by the given number of units', () => {
    const state = newStep(
      { ...typeAll('14:30'), selection: { start: 3, end: 5 } },
      'minutes',
      10,
      'HH:mm',
      'h23',
    );

    expect(state.view).toBe('14:40');
  });

  it('replaces the selected segment instead of appending', () => {
    const state = newType(
      { ...typeAll('14:30'), selection: { start: 3, end: 5 } },
      '5',
      'HH:mm',
      'h23',
    );

    // Замер настоящего поля: выделенные минуты заменены одной цифрой (`14:5`), дописывание за
    // выделением дало бы `14:305`. Второй цифры маска не ждет: каретка встала в конец сегмента.
    expect(state.view).toBe('14:5');
  });

  it('rejects a letter in the 24-hour cycle', () => {
    expect(newType(typeAll('02:30'), 'p', 'HH:mm', 'h23')).toMatchObject({
      view: '02:30',
      rejected: true,
    });
  });

  it('recognizes a paste and reports it', () => {
    expect(newPaste(newEmpty('HH:mm', 'h23'), 'встреча в 15:30', 'HH:mm', 'h23')).toMatchObject({
      view: '15:30',
      value: '15:30',
      recognized: 'Распознано как 15:30',
    });
  });

  it('keeps an empty paste without an error', () => {
    expect(newPaste(newEmpty('HH:mm', 'h23'), '   ', 'HH:mm', 'h23')).toMatchObject({
      view: '',
      value: null,
      error: null,
    });
  });

  it('keeps an unrecognized paste as text', () => {
    expect(
      newBlur(newPaste(newEmpty('HH:mm', 'h23'), '14:30\n15:00', 'HH:mm', 'h23'), 'HH:mm', 'h23'),
    ).toMatchObject({
      view: '14:30 15:00',
      value: null,
      error: 'Введите время в формате ЧЧ:ММ, например 14:30',
    });
  });

  it('keeps a paste of nothing but spaces empty', () => {
    expect(newPaste(newEmpty('HH:mm', 'h23'), '', 'HH:mm', 'h23')).toMatchObject({
      view: '',
      selection: { start: 0, end: 0 },
      value: null,
      recognized: null,
      rejected: false,
    });
  });

  it('starts an empty field from zero on the arrow keys', () => {
    const up = newStep(newEmpty('HH:mm', 'h23'), 'hours', 1, 'HH:mm', 'h23');

    // Выделение остается на часах — на том сегменте, который шагнул.
    expect([up.view, up.value, up.selection]).toEqual(['01:00', '01:00', { start: 0, end: 2 }]);

    const down = newStep(newEmpty('HH:mm', 'h23'), 'hours', -1, 'HH:mm', 'h23');

    expect([down.view, down.value]).toEqual(['23:00', '23:00']);
  });

  it('leaves an unreadable view alone on a step', () => {
    expect(newStep(typeAll('25:88'), 'hours', 1, 'HH:mm', 'h23')).toMatchObject({
      view: '25:08',
      value: null,
      rejected: false,
    });
  });

  it('completes the hours on blur and reports the rewritten view', () => {
    // `12:` маска оставляет недонабранным, полное время появляется только по blur.
    expect(newBlur(typeAll('12'), 'HH:mm', 'h23')).toMatchObject({
      view: '12:00',
      value: '12:00',
      error: null,
      recognized: 'Распознано как 12:00',
    });
  });

  it('clears a view of nothing but spaces on blur', () => {
    // Набрать такое в поле нельзя (пробел маска не пускает), но сырой вид после вставки
    // директива считает пустым и по blur переписывает в пустую строку.
    expect(newBlur({ ...newEmpty('HH:mm', 'h23'), view: '  ' }, 'HH:mm', 'h23')).toMatchObject({
      view: '',
      value: null,
      error: null,
      recognized: null,
    });
  });

  it('keeps the error until an edit reads the view', () => {
    const blurred = newBlur(typeAll('25:88'), 'HH:mm', 'h23');

    // Минуты заменены, час по-прежнему вне диапазона: директива поднимает `parseErrorState`, но
    // проверку не снимает (`applyEdit`), поэтому ошибка остается.
    const failed = newType({ ...blurred, selection: { start: 3, end: 5 } }, '9', 'HH:mm', 'h23');

    expect([failed.view, failed.error]).toEqual(['25:09', ERROR_TEXT]);

    // Читаемый вид — удачное чтение: директива гасит ошибку без blur.
    const good = newType({ ...failed, selection: { start: 0, end: 2 } }, '1', 'HH:mm', 'h23');

    expect([good.view, good.error]).toEqual(['1:09', null]);
  });

  it('keeps the error through an unreadable paste and drops it on a recognized one', () => {
    const blurred = newBlur(typeAll('25:88'), 'HH:mm', 'h23');
    const kept = newPaste(blurred, 'abc', 'HH:mm', 'h23');

    expect([kept.view, kept.value, kept.error]).toEqual(['25:08abc', null, ERROR_TEXT]);

    expect(newPaste(newEmpty('HH:mm', 'h23'), 'abc', 'HH:mm', 'h23').error).toBeNull();
    expect(newPaste(blurred, '9:5', 'HH:mm', 'h23').error).toBeNull();
  });
});

/** Разметка как в демо: значение ходит через форму, маска и клавиши — на самой директиве. */
class HostState {
  readonly format = signal<TimeFormat>(FORMAT);
  readonly cycle = signal<HourCycle>(CYCLE);
  readonly control = new FormControl<string | null>(null);
}

@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, TimeInputDirective],
  template: `
    <kbq-form-field>
      <input kbqTimeInput [format]="format()" [hourCycle]="cycle()" [formControl]="control" />
    </kbq-form-field>
  `,
})
class Host extends HostState {}

interface Field {
  fixture: ComponentFixture<Host>;
  input: HTMLInputElement;
}

async function render(format: TimeFormat = FORMAT, cycle: HourCycle = CYCLE): Promise<Field> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

  const fixture = TestBed.createComponent(Host);

  fixture.componentInstance.format.set(format);
  fixture.componentInstance.cycle.set(cycle);
  fixture.detectChanges();
  await fixture.whenStable();

  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

  input.focus();
  fixture.detectChanges();

  return { fixture, input };
}

const directiveOf = (field: Field): TimeInputDirective =>
  field.fixture.debugElement
    .query(By.directive(TimeInputDirective))
    .injector.get(TimeInputDirective);

/** Клавиша в поле: печатный символ маска гасит сама, поэтому события `input` после него нет. */
function press(field: Field, key: string, init: KeyboardEventInit = {}): void {
  field.input.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
  field.fixture.detectChanges();
}

function typeText(field: Field, text: string): void {
  for (const char of text) press(field, char);
}

/**
 * Вставка из буфера: в jsdom нет ни `DataTransfer`, ни `ClipboardEvent`, поэтому событие
 * собирается из обычного `Event('paste')` с подмененным `clipboardData`.
 */
function paste(field: Field, text: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  field.input.dispatchEvent(event);

  // Браузер вставил бы текст сам, но директива гасит событие и вставляет его своими руками.
  if (!event.defaultPrevented) {
    field.input.value = text;
    field.input.dispatchEvent(new Event('input'));
  }

  field.fixture.detectChanges();
}

function blur(field: Field): void {
  field.input.dispatchEvent(new Event('blur'));
  field.fixture.detectChanges();
}

/** Состояние модели после набора текста в пустое поле: те же символы, что получает директива. */
const typedState = (
  text: string,
  format: TimeFormat = FORMAT,
  cycle: HourCycle = CYCLE,
): NewState =>
  [...text].reduce((state, char) => newType(state, char, format, cycle), newEmpty(format, cycle));

/** Каретку и выделение модель получает из поля: клик и переходы ведет сама директива. */
const caretFromField = (field: Field, state: NewState): NewState => ({
  ...state,
  selection: {
    start: field.input.selectionStart ?? 0,
    end: field.input.selectionEnd ?? 0,
  },
});

/**
 * Подпись панели сверяется с настоящим полем: вид — с `input.value`, значение — с формой,
 * выделение — с `selectionStart`/`selectionEnd` поля.
 */
function expectSameAsField(field: Field, state: NewState): void {
  expect({
    view: state.view,
    value: state.value,
    selection: [state.selection.start, state.selection.end],
  }).toEqual({
    view: field.input.value,
    value: field.fixture.componentInstance.control.value,
    selection: [field.input.selectionStart, field.input.selectionEnd],
  });
}

interface PasteCase {
  text: string;
  view: string;
  value: string | null;
  recognized: string | null;
  errorAfterBlur: string | null;
}

/**
 * Строки вставки, которые попадут на страницу. Ожидания — замер настоящего поля: `14-16` директива
 * читает как время (дефис — законный разделитель в `time-input.parse`), хотя таблица кейсов ждет
 * текст с ошибкой.
 */
const PASTE_CASES: PasteCase[] = [
  {
    text: '1430',
    view: '14:30',
    value: '14:30',
    recognized: 'Распознано как 14:30',
    errorAfterBlur: null,
  },
  {
    text: '14-16',
    view: '14:16',
    value: '14:16',
    recognized: 'Распознано как 14:16',
    errorAfterBlur: null,
  },
  {
    text: '12.05.2025',
    view: '12.05.2025',
    value: null,
    recognized: null,
    errorAfterBlur: ERROR_TEXT,
  },
  {
    text: 'https://example.com/74-169/',
    view: 'https://example.com/74-169/',
    value: null,
    recognized: null,
    errorAfterBlur: ERROR_TEXT,
  },
  {
    text: 'abc123',
    view: 'abc123',
    value: null,
    recognized: null,
    errorAfterBlur: ERROR_TEXT,
  },
  {
    text: '25:99',
    view: '25:99',
    value: null,
    recognized: null,
    errorAfterBlur: ERROR_TEXT,
  },
];

describe('new field model: honest pair with the directive', () => {
  it('builds the view and the form value from digits', async () => {
    const field = await render();
    let state = newEmpty(FORMAT, CYCLE);

    for (const char of '1430') {
      press(field, char);
      state = newType(state, char, FORMAT, CYCLE);
      expectSameAsField(field, state);
    }

    expect([state.view, state.value]).toEqual(['14:30', '14:30']);
  });

  it('keeps an out-of-range hour as typed and explains the format on blur', async () => {
    const field = await render();
    let state = newEmpty(FORMAT, CYCLE);

    for (const char of '25:88') {
      press(field, char);
      state = newType(state, char, FORMAT, CYCLE);
      expectSameAsField(field, state);
      // На наборе ошибки нет: директива показывает её только по blur.
      expect(state.error).toBe(directiveOf(field).errorText());
    }

    const typed = state;

    blur(field);

    const blurred = newBlur(typed, FORMAT, CYCLE);

    expect(field.fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });
    expect([blurred.view, blurred.value]).toEqual([field.input.value, null]);
    expect(blurred.error).toBe(directiveOf(field).errorText());
    expect(blurred.error).toBe('Введите время в формате ЧЧ:ММ, например 14:30');
    expect(blurred.selection.start).toBe(field.input.selectionStart);
  });

  it('reads a meridiem letter in the 12-hour cycle', async () => {
    const field = await render(FORMAT, 'h12');
    let state = newEmpty(FORMAT, 'h12');

    for (const char of '0230p') {
      press(field, char);
      state = newType(state, char, FORMAT, 'h12');
      expectSameAsField(field, state);
    }

    expect([state.view, state.value]).toEqual(['02:30 PM', '14:30']);
  });

  it('steps the meridiem segment under the caret', async () => {
    const field = await render(FORMAT, 'h12');

    typeText(field, '0230p');

    const state = newStep(typedState('0230p', FORMAT, 'h12'), 'meridiem', 1, FORMAT, 'h12');

    press(field, 'ArrowUp');

    expectSameAsField(field, state);
    expect([state.view, state.value]).toEqual(['02:30 AM', '02:30']);
  });

  it('replaces the selected segment instead of appending', async () => {
    const field = await render();

    typeText(field, '1430');
    // Клик по минутам: директива выделяет сегмент целиком.
    field.input.setSelectionRange(4, 4);
    field.input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    field.fixture.detectChanges();

    let state = caretFromField(field, typedState('1430'));

    expect([state.selection.start, state.selection.end]).toEqual([3, 5]);

    press(field, '5');

    state = newType(state, '5', FORMAT, CYCLE);

    expectSameAsField(field, state);
    // Выделенные минуты заменены целиком: дописывание за выделением дало бы `14:305`.
    expect(state.view).toBe('14:5');
  });

  it('steps one unit and ten units with the segment under the caret', async () => {
    const field = await render();

    typeText(field, '1430');
    field.input.setSelectionRange(4, 4);
    field.input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    field.fixture.detectChanges();

    let state = caretFromField(field, typedState('1430'));

    press(field, 'ArrowUp');

    state = newStep(state, 'minutes', 1, FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect(state.view).toBe('14:31');

    // `LARGE_STEP` умножает вызывающий: директива делает это на входе в `increment`.
    press(field, 'ArrowUp', { shiftKey: true });

    state = newStep(state, 'minutes', 10, FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect(state.view).toBe('14:41');

    press(field, 'ArrowDown', { shiftKey: true });

    state = newStep(state, 'minutes', -10, FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect(state.view).toBe('14:31');
  });

  it('starts an empty field from zero on the arrow keys', async () => {
    const up = await render();

    press(up, 'ArrowUp');

    const steppedUp = newStep(newEmpty(FORMAT, CYCLE), 'hours', 1, FORMAT, CYCLE);

    expectSameAsField(up, steppedUp);
    expect([steppedUp.view, steppedUp.value]).toEqual(['01:00', '01:00']);

    const down = await render();

    press(down, 'ArrowDown');

    expectSameAsField(down, newStep(newEmpty(FORMAT, CYCLE), 'hours', -1, FORMAT, CYCLE));
    expect(down.input.value).toBe('23:00');
  });

  it('refuses a letter in the 24-hour cycle', async () => {
    const field = await render();

    typeText(field, '0230');

    let state = caretFromField(field, typedState('0230'));

    press(field, 'p');

    state = newType(state, 'p', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect([state.view, state.rejected]).toEqual(['02:30', true]);
  });

  it('recognizes a paste and reports it with the directive text', async () => {
    const field = await render();

    paste(field, 'встреча в 15:30');

    const state = newPaste(newEmpty(FORMAT, CYCLE), 'встреча в 15:30', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect(state.recognized).toBe(directiveOf(field).recognizedText());
    expect([state.view, state.value, state.recognized]).toEqual([
      '15:30',
      '15:30',
      'Распознано как 15:30',
    ]);
  });

  it('canonicalizes a torn paste and reports it', async () => {
    const field = await render();

    paste(field, '9:5');

    const state = newPaste(newEmpty(FORMAT, CYCLE), '9:5', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect(state.recognized).toBe(directiveOf(field).recognizedText());
    expect([state.view, state.recognized]).toEqual(['09:05', 'Распознано как 09:05']);
  });

  it('keeps an unrecognized paste as text and scolds only on blur', async () => {
    const field = await render();

    paste(field, '14:30\n15:00');

    const pasted = newPaste(newEmpty(FORMAT, CYCLE), '14:30\n15:00', FORMAT, CYCLE);

    expectSameAsField(field, pasted);
    expect([pasted.view, pasted.value, pasted.error]).toEqual(['14:30 15:00', null, null]);

    blur(field);

    const blurred = newBlur(pasted, FORMAT, CYCLE);

    expectSameAsField(field, blurred);
    expect(blurred.error).toBe(directiveOf(field).errorText());
    expect(blurred.error).toBe('Введите время в формате ЧЧ:ММ, например 14:30');
  });

  it('completes the hours on blur and reports the rewritten view', async () => {
    const field = await render();

    typeText(field, '12');

    const typed = typedState('12');

    blur(field);

    const blurred = newBlur(typed, FORMAT, CYCLE);

    expectSameAsField(field, blurred);
    expect([blurred.view, blurred.value]).toEqual(['12:00', '12:00']);
    expect(blurred.recognized).toBe(directiveOf(field).recognizedText());
  });

  it('keeps the recognized hint through a step and a digit, as the directive does', async () => {
    const field = await render();

    paste(field, '9:5');

    let state = newPaste(newEmpty(FORMAT, CYCLE), '9:5', FORMAT, CYCLE);

    // Каретка после вставки в конце вида — шаг берет минуты.
    press(field, 'ArrowUp');
    state = newStep(state, 'minutes', 1, FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect(state.view).toBe('09:06');
    // Тултип распознавания живет своим таймером: стрелки и цифры его не гасят.
    expect(state.recognized).toBe(directiveOf(field).recognizedText());

    field.input.setSelectionRange(0, 0);
    field.input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    field.fixture.detectChanges();

    state = caretFromField(field, state);
    press(field, '7');
    state = newType(state, '7', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect(state.view).toBe('07:06');
    expect(state.recognized).toBe(directiveOf(field).recognizedText());
  });

  it('keeps a canonical value quiet on blur', async () => {
    const field = await render();

    typeText(field, '1430');

    const typed = typedState('1430');

    blur(field);

    const blurred = newBlur(typed, FORMAT, CYCLE);

    expectSameAsField(field, blurred);
    expect([blurred.view, blurred.value, blurred.recognized]).toEqual(['14:30', '14:30', null]);
    expect(blurred.recognized).toBe(directiveOf(field).recognizedText());
  });

  it('treats an empty field as valid on blur', async () => {
    const field = await render();

    blur(field);

    const blurred = newBlur(newEmpty(FORMAT, CYCLE), FORMAT, CYCLE);

    expectSameAsField(field, blurred);
    expect([blurred.view, blurred.value, blurred.error, blurred.recognized]).toEqual([
      '',
      null,
      null,
      null,
    ]);
    expect(blurred.error).toBe(directiveOf(field).errorText());
    expect(field.fixture.componentInstance.control.errors).toBeNull();
  });

  it.each(PASTE_CASES)(
    'pins the paste $text to $view in the field and in the model',
    async (pasteCase: PasteCase) => {
      const field = await render();

      paste(field, pasteCase.text);

      const pasted = newPaste(newEmpty(FORMAT, CYCLE), pasteCase.text, FORMAT, CYCLE);

      // Вид, значение формы, выделение и состояние ошибки/распознавания — до blur.
      expectSameAsField(field, pasted);
      expect({
        view: pasted.view,
        value: pasted.value,
        error: pasted.error,
        recognized: pasted.recognized,
      }).toEqual({
        view: pasteCase.view,
        value: pasteCase.value,
        error: null,
        recognized: pasteCase.recognized,
      });
      expect(pasted.error).toBe(directiveOf(field).errorText());

      blur(field);

      const blurred = newBlur(pasted, FORMAT, CYCLE);

      // Повторная сверка после blur: канонизация ничего не переписывает, ошибка появляется только
      // у неразобранного текста.
      expectSameAsField(field, blurred);
      expect({
        view: blurred.view,
        value: blurred.value,
        error: blurred.error,
        recognized: blurred.recognized,
      }).toEqual({
        view: pasteCase.view,
        value: pasteCase.value,
        error: pasteCase.errorAfterBlur,
        recognized: null,
      });
      expect(blurred.error).toBe(directiveOf(field).errorText());
      expect(field.fixture.componentInstance.control.errors).toEqual(
        pasteCase.errorAfterBlur === null ? null : { kbqTimeInputParse: true },
      );
    },
  );

  it('keeps the error through a failed edit and clears it on a good one', async () => {
    const field = await render();

    typeText(field, '25:88');

    blur(field);

    let state = newBlur(typedState('25:88'), FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect([state.error, directiveOf(field).errorText()]).toEqual([ERROR_TEXT, ERROR_TEXT]);

    // Клик по минутам: сегмент выделен целиком, набор заменит его.
    field.input.setSelectionRange(4, 4);
    field.input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    field.fixture.detectChanges();

    state = caretFromField(field, state);

    // Неудачная правка: минуты заменены, час вне диапазона, вид не читается. Директива снимает
    // только `parseErrorState` — флаг проверки после blur остается, — поэтому ошибка живет.
    press(field, '9');

    state = newType(state, '9', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect([state.view, state.value]).toEqual(['25:09', null]);
    expect([state.error, directiveOf(field).errorText()]).toEqual([ERROR_TEXT, ERROR_TEXT]);
    expect(field.fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });

    // Клик по часам: одна цифра делает вид читаемым, ошибка гаснет без blur.
    field.input.setSelectionRange(0, 0);
    field.input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    field.fixture.detectChanges();

    state = caretFromField(field, state);

    press(field, '1');

    state = newType(state, '1', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect([state.view, state.value]).toEqual(['1:09', '01:09']);
    expect([state.error, directiveOf(field).errorText()]).toEqual([null, null]);
    expect(field.fixture.componentInstance.control.errors).toBeNull();
  });

  it('keeps the error through an unreadable paste and drops it after a recognized one', async () => {
    const field = await render();

    typeText(field, '25:88');

    blur(field);

    let state = newBlur(typedState('25:88'), FORMAT, CYCLE);

    // Текст вставляется в каретку и разбора не имеет: директива пересчитывает `parseErrorState`,
    // а проверку после blur не снимает — ошибка остается.
    paste(field, 'abc');

    state = newPaste(state, 'abc', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect([state.view, state.value, state.error]).toEqual(['25:08abc', null, ERROR_TEXT]);
    expect(state.error).toBe(directiveOf(field).errorText());
    expect(field.fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });

    // Распознанная вставка делает вид читаемым: ошибка гаснет без blur.
    paste(field, '9:5');

    state = newPaste(state, '9:5', FORMAT, CYCLE);

    expectSameAsField(field, state);
    expect([state.view, state.value, state.error]).toEqual(['09:05', '09:05', null]);
    expect(state.error).toBe(directiveOf(field).errorText());
    expect(field.fixture.componentInstance.control.errors).toBeNull();
  });
});
