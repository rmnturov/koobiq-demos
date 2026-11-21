import { Component, signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqToolTipModule, KbqTooltipTrigger } from '@koobiq/components/tooltip';
import { TimeInputDirective } from './time-input.directive';
import { HourCycle, TimeFormat } from './time-input.types';

class HostState {
  readonly format = signal<TimeFormat>('HH:mm');
  readonly cycle = signal<HourCycle>('h23');
  readonly control = new FormControl<string | null>(null);
}

@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, TimeInputDirective],
  template: `
    <kbq-form-field>
      <kbq-label>Время</kbq-label>
      <input kbqTimeInput [format]="format()" [hourCycle]="cycle()" [formControl]="control" />
    </kbq-form-field>
  `,
})
class Host extends HostState {}

/** Хост с обязательным полем и признаком попытки отправки: так проверяется ошибка пустого поля. */
@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, TimeInputDirective],
  template: `
    <kbq-form-field>
      <input
        kbqTimeInput
        [required]="required()"
        [kbqSubmitAttempted]="attempted()"
        [format]="format()"
        [hourCycle]="cycle()"
        [formControl]="control"
      />
    </kbq-form-field>
  `,
})
class SubmitHost extends HostState {
  readonly required = signal(true);
  readonly attempted = signal(false);
}

/** Хост combobox: подсказки включены, триггер переключается тестом. */
@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, TimeInputDirective],
  template: `
    <kbq-form-field>
      <input
        kbqTimeInput
        [format]="format()"
        [hourCycle]="cycle()"
        [formControl]="control"
        [kbqSuggestions]="true"
        [kbqSuggestionOpenOnFocus]="openOnFocus()"
      />
    </kbq-form-field>
  `,
})
class SuggestHost extends HostState {
  readonly openOnFocus = signal(true);
}

async function render<T extends HostState>(
  component: Type<T> = Host as unknown as Type<T>,
): Promise<{ fixture: ComponentFixture<T>; input: HTMLInputElement }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [component] }).compileComponents();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, input: fixture.nativeElement.querySelector('input') as HTMLInputElement };
}

const blur = (input: HTMLInputElement) => {
  input.dispatchEvent(new Event('blur'));
};

const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event('input'));
};

const directiveOf = (fixture: ComponentFixture<unknown>): TimeInputDirective =>
  fixture.debugElement.query(By.directive(TimeInputDirective)).injector.get(TimeInputDirective);

describe('TimeInputDirective value and error', () => {
  it('renders the form value and the mask placeholder in focus', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    expect(input.value).toBe('14:30');
    expect(input.placeholder).toBe('');

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.placeholder).toBe('ЧЧ:ММ');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('shows the mask on hover and hides it on leave', async () => {
    const { fixture, input } = await render();
    expect(input.placeholder).toBe('');

    input.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(input.placeholder).toBe('ЧЧ:ММ');

    input.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(input.placeholder).toBe('');
  });

  it('clears the field for a null form value', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    fixture.componentInstance.control.setValue(null);
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(fixture.componentInstance.control.errors).toBeNull();
  });

  it('canonicalizes on blur and reports the new value', async () => {
    const { fixture, input } = await render();
    input.value = '14-30';
    input.dispatchEvent(new Event('input'));
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('14:30');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('shows the format error after blur and keeps the text', async () => {
    const { fixture, input } = await render();
    input.value = 'abc123';
    input.dispatchEvent(new Event('input'));
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('abc123');
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('treats an empty field as valid', async () => {
    const { fixture, input } = await render();
    blur(input);
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();
    expect(input.value).toBe('');
  });

  it('does not scold an empty required field on blur', async () => {
    const { fixture, input } = await render(SubmitHost);
    blur(input);
    fixture.detectChanges();
    expect(directiveOf(fixture).errorText()).toBeNull();
    expect(directiveOf(fixture).errorState()).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('shows only the red frame for an empty required field after a submit attempt', async () => {
    const { fixture, input } = await render(SubmitHost);
    fixture.componentInstance.attempted.set(true);
    fixture.componentInstance.control.markAsTouched();
    fixture.componentInstance.control.updateValueAndValidity();
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ required: true });
    expect(directiveOf(fixture).errorText()).toBeNull();
    expect(directiveOf(fixture).errorState()).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    type(input, '14:30');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();
    expect(directiveOf(fixture).errorState()).toBe(false);
  });

  it('does not turn a valid required field red while its value is being cleared', async () => {
    const { fixture, input } = await render(SubmitHost);
    type(input, '12:00');
    blur(input);
    fixture.detectChanges();

    input.dispatchEvent(new Event('focus'));
    type(input, '12:');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ required: true });
    expect(directiveOf(fixture).errorState()).toBe(false);
    expect(directiveOf(fixture).errorText()).toBeNull();

    type(input, '25:');
    fixture.detectChanges();
    expect(directiveOf(fixture).errorState()).toBe(false);

    blur(input);
    fixture.detectChanges();
    expect(directiveOf(fixture).errorState()).toBe(true);
    expect(directiveOf(fixture).errorText()).not.toBeNull();
  });

  it('marks the input invalid while the error is visible', async () => {
    const { fixture, input } = await render();
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    blur(input);
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      fixture.nativeElement
        .querySelector('kbq-form-field')
        .classList.contains('kbq-form-field_invalid'),
    ).toBe(true);
  });

  it('keeps the shown error until the text becomes valid', async () => {
    const { fixture, input } = await render();
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    blur(input);
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });

    input.value = '25:';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });

    input.value = '14:30';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();
    expect(directiveOf(fixture).errorText()).toBeNull();
  });

  it('does not turn a valid field invalid while the user edits it', async () => {
    const { fixture, input } = await render();
    type(input, '14:30');
    blur(input);
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    input.value = '14:';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();
    expect(directiveOf(fixture).errorText()).toBeNull();

    input.value = '25:';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();

    blur(input);
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });
  });

  it('keeps the error away before the first blur', async () => {
    const { fixture, input } = await render();
    type(input, 'abc');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();
    expect(directiveOf(fixture).errorText()).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('explains the precision and the sample in the error text', async () => {
    const { fixture, input } = await render();
    type(input, 'abc');
    blur(input);
    fixture.detectChanges();
    expect(directiveOf(fixture).errorText()).toBe('Введите время в формате ЧЧ:ММ, например 14:30');
    expect(directiveOf(fixture).invalidText()).toBe('Только цифры');
  });

  it('asks for the meridiem only in the 12-hour cycle', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.cycle.set('h12');
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.placeholder).toBe('ЧЧ:ММ AM');
    expect(directiveOf(fixture).invalidText()).toBe('Только цифры и AM/PM');
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    expect(input.value).toBe('02:30 PM');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('drops the error text for an empty field after blur', async () => {
    const { fixture, input } = await render();
    blur(input);
    fixture.detectChanges();
    expect(directiveOf(fixture).errorText()).toBeNull();
    expect(directiveOf(fixture).recognizedText()).toBeNull();
  });

  it('shows a form value it cannot read as is and keeps the model empty', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.control.setValue('abc', { emitModelToViewChange: true });
    fixture.detectChanges();
    expect(input.value).toBe('abc');
    expect(fixture.componentInstance.control.errors).toBeNull();
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('abc');
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });
  });

  it('reports the value as a canonical 24-hour string', async () => {
    const { fixture, input } = await render();
    type(input, '2:30 pm');
    fixture.detectChanges();
    expect(directiveOf(fixture).value()).toBe('14:30');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('keeps hidden precision when the format narrows and widens', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.format.set('HH:mm:ss.SSS');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.control.setValue('14:30:15.250');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.format.set('HH:mm');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toBe('14:30');
    fixture.componentInstance.format.set('HH:mm:ss.SSS');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.control.value).toBe('14:30:15.250');
    fixture.detectChanges();
    expect(input.value).toBe('14:30:15.250');
  });

  it('rerenders the view for a new precision', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.format.set('HH:mm:ss');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input.value).toBe('14:30:00');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(input.placeholder).toBe('ЧЧ:ММ:СС');
    expect(fixture.componentInstance.control.value).toBe('14:30:00');
  });

  it('clears the field and the error for a null form value', async () => {
    const { fixture, input } = await render();
    type(input, 'abc');
    blur(input);
    fixture.detectChanges();
    expect(directiveOf(fixture).errorText()).not.toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fixture.componentInstance.control.setValue(null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.value).toBe('');
    expect(directiveOf(fixture).empty()).toBe(true);
    expect(directiveOf(fixture).errorText()).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(fixture.componentInstance.control.errors).toBeNull();
  });
});

const typeKeys = (input: HTMLInputElement, text: string) => {
  for (const char of text) {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }),
    );
  }
};

const press = (input: HTMLInputElement, key: string, init: KeyboardEventInit = {}) =>
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );

@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, TimeInputDirective],
  template: `
    <kbq-form-field>
      <input
        kbqTimeInput
        [kbqValidationTooltip]="tooltip"
        [format]="format()"
        [hourCycle]="cycle()"
        [formControl]="control"
      />
    </kbq-form-field>
  `,
})
class ValidationTooltipHost extends HostState {
  readonly show = vi.fn();
  readonly tooltip = { show: this.show, hide: vi.fn() } as unknown as KbqTooltipTrigger;
}

describe('TimeInputDirective typing', () => {
  it('builds the value from digits and separators', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    fixture.detectChanges();
    expect(input.value).toBe('14:30');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('rejects a letter without changing the view', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '14');
    typeKeys(input, 'a');
    fixture.detectChanges();
    expect(input.value).toBe('14:');
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('ignores digits after the end of the mask', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '143000');
    fixture.detectChanges();
    expect(input.value).toBe('14:30');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('selects the segment on click and replaces it with a digit', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    input.setSelectionRange(4, 4);
    input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fixture.detectChanges();
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(5);
    typeKeys(input, '5');
    fixture.detectChanges();
    expect(input.value).toBe('14:5');
  });

  it('moves between segments with arrows', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    input.setSelectionRange(0, 0);
    press(input, 'ArrowRight');
    fixture.detectChanges();
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(5);
  });

  it('moves the caret to minutes from an empty field with ArrowRight', async () => {
    const { fixture, input } = await render();
    press(input, 'ArrowRight');
    fixture.detectChanges();
    expect(input.value).toBe('00:');
    expect(input.selectionStart).toBe(3);
    expect(fixture.componentInstance.control.value).toBeNull();

    typeKeys(input, '30');
    fixture.detectChanges();
    expect(input.value).toBe('00:30');
    expect(fixture.componentInstance.control.value).toBe('00:30');
  });

  it('returns to empty on blur when only the caret was moved to minutes', async () => {
    const { fixture, input } = await render();
    press(input, 'ArrowRight');
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(fixture.componentInstance.control.value).toBeNull();
    expect(directiveOf(fixture).empty()).toBe(true);
    expect(directiveOf(fixture).errorText()).toBeNull();
  });

  it('writes 12 AM as the zero hour in the 12-hour cycle', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.cycle.set('h12');
    fixture.detectChanges();
    press(input, 'ArrowRight');
    fixture.detectChanges();
    expect(input.value).toBe('12: AM');
    expect(fixture.componentInstance.control.value).toBeNull();

    typeKeys(input, '30');
    fixture.detectChanges();
    expect(input.value).toBe('12:30 AM');
    expect(fixture.componentInstance.control.value).toBe('00:30');
  });

  it('keeps the caret at the start of an empty field on a mask click', async () => {
    const { fixture, input } = await render();

    input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, detail: 1, clientX: 30 }));
    fixture.detectChanges();

    expect(input.value).toBe('');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(0);
    expect(directiveOf(fixture).empty()).toBe(true);
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('clears a segment with Backspace', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    input.setSelectionRange(3, 5);
    press(input, 'Backspace');
    fixture.detectChanges();
    expect(input.value).toBe('14:');
  });

  it('increments the segment under the caret', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    input.setSelectionRange(3, 5);
    press(input, 'ArrowUp');
    fixture.detectChanges();
    expect(input.value).toBe('14:31');
    expect(fixture.componentInstance.control.value).toBe('14:31');
  });

  it('starts an empty field from zero on the arrow keys', async () => {
    const { fixture, input } = await render();
    input.focus();
    press(input, 'ArrowUp');
    fixture.detectChanges();
    expect(input.value).toBe('01:00');
    expect(fixture.componentInstance.control.value).toBe('01:00');

    const empty = await render();
    empty.input.focus();
    press(empty.input, 'ArrowDown');
    empty.fixture.detectChanges();
    expect(empty.input.value).toBe('23:00');
  });

  it('steps ten units with Shift held', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    input.setSelectionRange(3, 5);
    press(input, 'ArrowUp', { shiftKey: true });
    fixture.detectChanges();
    expect(input.value).toBe('14:40');
    expect(fixture.componentInstance.control.value).toBe('14:40');

    press(input, 'ArrowDown', { shiftKey: true });
    fixture.detectChanges();
    expect(input.value).toBe('14:30');
  });

  it('completes hours only to a full time on blur', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '12');
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('12:00');
    expect(fixture.componentInstance.control.value).toBe('12:00');
    expect(directiveOf(fixture).errorText()).toBeNull();
  });

  it('re-renders and re-emits when the format changes', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    fixture.componentInstance.format.set('HH:mm:ss');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.value).toBe('14:30:00');
    expect(fixture.componentInstance.control.value).toBe('14:30:00');
  });

  it('keeps incomplete text when the format changes', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '143');
    fixture.componentInstance.format.set('HH:mm:ss');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input.value).toBe('14:3');
  });

  it('jumps to the first and the last segment with Home, End, PgUp and PgDn', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    input.setSelectionRange(3, 5);
    press(input, 'Home');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 2]);
    press(input, 'End');
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 5]);
    press(input, 'PageUp');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 2]);
    press(input, 'PageDown');
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 5]);
  });

  it('clears the segment with Delete', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '1430');
    input.setSelectionRange(3, 5);
    press(input, 'Delete');
    fixture.detectChanges();
    expect(input.value).toBe('14:');
  });

  it('sets the meridiem with a letter in the 12-hour cycle', async () => {
    const { fixture, input } = await render();
    fixture.componentInstance.cycle.set('h12');
    fixture.detectChanges();
    typeKeys(input, '0230');
    fixture.detectChanges();
    expect(input.value).toBe('02:30 AM');
    typeKeys(input, 'p');
    fixture.detectChanges();
    expect(input.value).toBe('02:30 PM');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('leaves the view alone for a keyboard shortcut', async () => {
    const { fixture, input } = await render();
    typeKeys(input, '14');
    press(input, '5', { ctrlKey: true });
    press(input, '5', { metaKey: true });
    press(input, '5', { altKey: true });
    fixture.detectChanges();
    expect(input.value).toBe('14:');
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('shows the invalid tooltip for a rejected key and keeps the caret', async () => {
    const { fixture, input } = await render(ValidationTooltipHost);
    typeKeys(input, '14');
    input.setSelectionRange(3, 3);
    press(input, 'x');
    fixture.detectChanges();
    expect(fixture.componentInstance.show).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('14:');
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3]);
  });
});

const paste = (input: HTMLInputElement, text: string): Event => {
  const event = new Event('paste', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  input.dispatchEvent(event);

  // Браузер вставляет текст сам: директиву догоняет `input`.
  if (!event.defaultPrevented) {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  return event;
};

/** Символ, набранный мимо маски: keydown и, если он не погашен, нативная вставка с `input`. */
const nativeType = (input: HTMLInputElement, char: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true });

  input.dispatchEvent(event);

  if (!event.defaultPrevented) {
    input.value += char;
    input.dispatchEvent(new Event('input'));
  }

  return event;
};

const tooltip = () => ({ show: vi.fn(), hide: vi.fn() });

@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, TimeInputDirective],
  template: `
    <kbq-form-field>
      <input
        kbqTimeInput
        [kbqValidationTooltip]="invalid"
        [kbqRecognizedTooltip]="recognized"
        [format]="format()"
        [hourCycle]="cycle()"
        [formControl]="control"
        [kbqClearable]="true"
      />
    </kbq-form-field>
  `,
})
class TooltipHost extends HostState {
  readonly invalid = tooltip() as unknown as KbqTooltipTrigger;
  readonly recognized = tooltip() as unknown as KbqTooltipTrigger;
}

/**
 * Настоящий `KbqTooltipTrigger`: контент тултипа приходит в него шаблоном из `recognizedText()`,
 * как в демо, и обновляется только проверкой изменений — поэтому проверять нужно её.
 */
@Component({
  imports: [ReactiveFormsModule, KbqFormFieldModule, TimeInputDirective, KbqToolTipModule],
  template: `
    <kbq-form-field>
      <input
        kbqTimeInput
        #field="kbqTimeInput"
        #tip="kbqTooltip"
        [kbqTooltip]="field.recognizedText() ?? ''"
        [kbqRecognizedTooltip]="tip"
        [format]="format()"
        [hourCycle]="cycle()"
        [formControl]="control"
      />
    </kbq-form-field>
  `,
})
class RealTooltipHost extends HostState {}

describe('TimeInputDirective paste and tooltips', () => {
  it('replaces the value for a recognized paste', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, 'встреча в 15:30');
    fixture.detectChanges();
    expect(input.value).toBe('15:30');
    expect(fixture.componentInstance.control.value).toBe('15:30');
  });

  it('keeps an unrecognized paste as is until blur', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, 'abc123');
    fixture.detectChanges();
    expect(input.value).toBe('abc123');
    expect(fixture.componentInstance.control.value).toBeNull();
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('abc123');
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });
  });

  it('keeps the error when an invalid paste replaces the text', async () => {
    const { fixture, input } = await render(TooltipHost);
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    blur(input);
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });

    paste(input, '25:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });
  });

  it('clears the error when a valid paste replaces the text', async () => {
    const { fixture, input } = await render(TooltipHost);
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    blur(input);
    fixture.detectChanges();

    paste(input, '14:30');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();
  });

  it('does not check an invalid paste into a valid field until blur', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, '14:30');
    blur(input);
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    paste(input, '25:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toBeNull();

    blur(input);
    fixture.detectChanges();
    expect(fixture.componentInstance.control.errors).toEqual({ kbqTimeInputParse: true });
  });

  it('ignores an image paste', async () => {
    const { fixture, input } = await render(TooltipHost);
    const event = new Event('paste', { bubbles: true, cancelable: true });

    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => '', items: [{ kind: 'file', type: 'image/png' }] },
    });
    input.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
  });

  it('glues a multiline paste without a readable time', async () => {
    const { fixture, input } = await render(TooltipHost);
    const event = paste(input, '14:30\n\n  15:00 ');
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('14:30 15:00');
    expect(fixture.componentInstance.control.errors).toBeNull();
  });

  it('shows and hides the invalid character tooltip', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    type(input, 'a');
    expect(host.invalid.show).toHaveBeenCalled();
    type(input, '1');
    expect(host.invalid.hide).toHaveBeenCalled();
  });

  it('shows the recognized tooltip and hides it on the next input', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    paste(input, '14-30');
    fixture.detectChanges();
    expect(host.recognized.show).toHaveBeenCalled();
    type(input, '1');
    expect(host.recognized.hide).toHaveBeenCalled();
  });

  it('closes the tooltip on Escape and clears the field on the next Escape', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    paste(input, '14:30');
    fixture.detectChanges();
    expect(host.recognized.show).toHaveBeenCalled();

    press(input, 'Escape');
    fixture.detectChanges();

    expect(host.recognized.hide).toHaveBeenCalled();
    expect(input.value).toBe('14:30');
    expect(fixture.componentInstance.control.value).toBe('14:30');

    press(input, 'Escape');
    fixture.detectChanges();

    expect(input.value).toBe('');
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('filters a composed letter and shows the invalid tooltip', async () => {
    const { fixture, input } = await render(TooltipHost);
    input.value = '14:30a';
    input.dispatchEvent(new CompositionEvent('compositionend', { data: 'a' }));
    fixture.detectChanges();
    expect(input.value).toBe('14:30');
  });

  it('reports the recognized view for a torn paste', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, '9:5');
    fixture.detectChanges();
    expect(input.value).toBe('09:05');
    expect(directiveOf(fixture).recognizedText()).toBe('Распознано как 09:05');
  });

  it('takes only the time from a multiline paste', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, 'Встреча\nв 15:30');
    fixture.detectChanges();
    expect(input.value).toBe('15:30');
    expect(fixture.componentInstance.control.value).toBe('15:30');
  });

  it('hides the recognized tooltip after the validation delay', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    vi.useFakeTimers();
    try {
      paste(input, '14-30');
      fixture.detectChanges();
      expect(host.recognized.show).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(3000);
      expect(host.recognized.hide).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('types allowed characters into a raw value without the mask', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, 'abc');
    fixture.detectChanges();

    const event = nativeType(input, '1');
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(false);
    expect(input.value).toBe('abc1');
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('rejects a forbidden character in a raw value', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    paste(input, 'abc');
    fixture.detectChanges();

    const event = nativeType(input, 'x');
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('abc');
    expect(host.invalid.show).toHaveBeenCalled();
  });

  it('does not select a mask segment in a raw value', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, 'abc');
    fixture.detectChanges();
    input.setSelectionRange(1, 1);
    input.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fixture.detectChanges();
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1]);
  });

  it('leaves the raw state when the field is cleared', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, 'abc');
    fixture.detectChanges();
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    typeKeys(input, '1430');
    fixture.detectChanges();

    expect(input.value).toBe('14:30');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });

  it('canonicalizes a raw value on blur and reports it', async () => {
    const { fixture, input } = await render(TooltipHost);
    paste(input, 'abc');
    fixture.detectChanges();
    input.value = '15:3';
    input.dispatchEvent(new Event('input'));
    blur(input);
    fixture.detectChanges();

    expect(input.value).toBe('15:03');
    expect(directiveOf(fixture).recognizedText()).toBe('Распознано как 15:03');
  });

  it('reports the view blur has rewritten', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    type(input, '9:5');
    blur(input);
    fixture.detectChanges();
    expect(input.value).toBe('09:05');
    expect(directiveOf(fixture).recognizedText()).toBe('Распознано как 09:05');
    expect(host.recognized.show).toHaveBeenCalled();
  });

  it('keeps the recognized tooltip quiet when blur leaves the text alone', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    type(input, '14:30');
    blur(input);
    fixture.detectChanges();
    expect(host.recognized.show).not.toHaveBeenCalled();
    expect(directiveOf(fixture).recognizedText()).toBeNull();
  });

  it('shows one tooltip at a time with the rejected character first', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    paste(input, '14-30');
    fixture.detectChanges();
    expect(host.recognized.show).toHaveBeenCalled();

    press(input, 'x');
    fixture.detectChanges();
    expect(host.invalid.show).toHaveBeenCalled();
    expect(host.recognized.hide).toHaveBeenCalled();

    paste(input, '15:30');
    fixture.detectChanges();
    expect(host.recognized.show).toHaveBeenCalledTimes(2);
    expect(host.invalid.hide).toHaveBeenCalled();
  });

  it('shows the real tooltip only once its content is bound', async () => {
    const { fixture, input } = await render(RealTooltipHost);
    const trigger = fixture.debugElement
      .query(By.directive(KbqTooltipTrigger))
      .injector.get(KbqTooltipTrigger);
    const shown: unknown[] = [];

    // Оверлей в jsdom не открывается: запоминаем контент триггера в момент показа.
    vi.spyOn(trigger, 'show').mockImplementation(() => {
      shown.push(trigger.content);
    });

    paste(input, '14-30');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain('Распознано как 14:30');
  });

  it('hides both tooltips when the format changes', async () => {
    const { fixture, input } = await render(TooltipHost);
    const host = fixture.componentInstance as TooltipHost;
    paste(input, '14-30');
    fixture.detectChanges();
    press(input, 'x');
    fixture.detectChanges();

    fixture.componentInstance.format.set('HH:mm:ss');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.recognized.hide).toHaveBeenCalled();
    expect(host.invalid.hide).toHaveBeenCalled();
  });

  it('ignores the keyboard during a composition', async () => {
    const { input } = await render(TooltipHost);
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    // `dispatchEvent` возвращает false, если keydown погашен.
    expect(press(input, 'a')).toBe(true);
    expect(input.value).toBe('');
  });

  it('reads the text composed through an input event', async () => {
    const { fixture, input } = await render(TooltipHost);
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = '14:30';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new CompositionEvent('compositionend'));
    fixture.detectChanges();
    expect(input.value).toBe('14:30');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });
});

describe('TimeInputDirective suggestions', () => {
  it('opens an empty field on focus in focus mode', async () => {
    const { fixture, input } = await render(SuggestHost);
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const directive = directiveOf(fixture);
    expect(directive.suggestionsOpen()).toBe(true);
    expect(directive.suggestions()).toHaveLength(48);
    expect(directive.activeSuggestion()).toBe(0);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe(directive.suggestionListId);
    expect(input.getAttribute('aria-activedescendant')).toBe(directive.suggestionOptionId(0));
  });

  it('starts the list at the value in the field', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    press(input, 'ArrowDown', { altKey: true });
    fixture.detectChanges();

    const directive = directiveOf(fixture);
    expect(directive.suggestionText(directive.suggestions()[0])).toBe('14:30');
  });

  it('shows the whole grid on a filled field focus and marks the current value', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const directive = directiveOf(fixture);
    const [first] = directive.suggestions();

    expect(directive.suggestions()).toHaveLength(48);
    expect(directive.suggestionText(first)).toBe('14:30');
    expect(directive.isSuggestionSelected(first)).toBe(true);
    expect(directive.isSuggestionSelected(directive.suggestions()[1])).toBe(false);
  });

  it('does not open on focus without the focus option and opens on a digit', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.openOnFocus.set(false);
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);

    typeKeys(input, '1');
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(true);
  });

  it('filters the autocomplete list by the typed prefix', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.openOnFocus.set(false);
    fixture.detectChanges();

    typeKeys(input, '11');
    fixture.detectChanges();

    const directive = directiveOf(fixture);
    expect(directive.suggestions().map((value) => directive.suggestionText(value))).toEqual([
      '11:00',
      '11:30',
    ]);
    expect(directive.activeSuggestion()).toBe(0);
  });

  it('leaves a single exact match for a complete value and closes without matches', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.openOnFocus.set(false);
    fixture.detectChanges();

    typeKeys(input, '1430');
    fixture.detectChanges();

    const directive = directiveOf(fixture);
    expect(directive.suggestions().map((value) => directive.suggestionText(value))).toEqual([
      '14:30',
    ]);

    fixture.componentInstance.control.setValue(null);
    fixture.detectChanges();
    typeKeys(input, '25');
    fixture.detectChanges();

    expect(directive.suggestionsOpen()).toBe(false);
  });

  it('does not open on focus when only the chevron can open it', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.openOnFocus.set(false);
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);

    directiveOf(fixture).toggleSuggestions();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(true);

    directiveOf(fixture).toggleSuggestions();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);
  });

  it('opens on Alt+ArrowDown and walks the list with plain arrows', async () => {
    const { fixture, input } = await render(SuggestHost);
    const directive = directiveOf(fixture);

    press(input, 'ArrowDown', { altKey: true });
    fixture.detectChanges();
    expect(directive.suggestionsOpen()).toBe(true);
    expect(directive.activeSuggestion()).toBe(0);

    press(input, 'ArrowDown');
    expect(directive.activeSuggestion()).toBe(1);

    press(input, 'ArrowUp');
    expect(directive.activeSuggestion()).toBe(0);
  });

  it('opens at the last option on Alt+ArrowUp', async () => {
    const { fixture, input } = await render(SuggestHost);
    const directive = directiveOf(fixture);

    press(input, 'ArrowUp', { altKey: true });
    fixture.detectChanges();
    expect(directive.suggestionsOpen()).toBe(true);
    expect(directive.activeSuggestion()).toBe(47);
  });

  it('closes the open list on Alt+ArrowUp and keeps the typed value', async () => {
    const { fixture, input } = await render(SuggestHost);

    typeKeys(input, '14:30');
    fixture.detectChanges();

    press(input, 'ArrowDown', { altKey: true });
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(true);

    press(input, 'ArrowUp', { altKey: true });
    fixture.detectChanges();

    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);
    expect(input.value).toBe('14:30');
  });

  it('leaves plain arrows to the segments while the list is closed', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.openOnFocus.set(false);
    fixture.detectChanges();

    press(input, 'ArrowDown');
    fixture.detectChanges();

    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);
    expect(input.value).not.toBe('');
  });

  it('reopens with Alt+ArrowDown after a suggestion was taken', async () => {
    const { fixture, input } = await render(SuggestHost);
    const directive = directiveOf(fixture);

    directive.selectSuggestion({ hours: 14, minutes: 30, seconds: 0, milliseconds: 0 });
    fixture.detectChanges();
    expect(directive.suggestionsOpen()).toBe(false);

    press(input, 'ArrowDown');
    fixture.detectChanges();
    expect(directive.suggestionsOpen()).toBe(false);
    expect(input.value).not.toBe('14:30');

    press(input, 'ArrowDown', { altKey: true });
    fixture.detectChanges();
    expect(directive.suggestionsOpen()).toBe(true);
    expect(directive.suggestions()).toHaveLength(48);
  });

  it('selects the active option with Enter and closes the list', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    press(input, 'ArrowDown');
    press(input, 'Enter');
    fixture.detectChanges();

    const directive = directiveOf(fixture);
    expect(input.value).toBe('15:00');
    expect(fixture.componentInstance.control.value).toBe('15:00');
    expect(directive.suggestionsOpen()).toBe(false);
  });

  it('closes the list on Enter when the value is not in the grid and leaves the key to the form', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.control.setValue('14:35');
    fixture.detectChanges();

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const directive = directiveOf(fixture);

    expect(directive.suggestionsOpen()).toBe(true);
    // Сетка на полчаса: 14:35 в ней нет, поэтому подсветки нет и выбирать нечего.
    expect(directive.suggestions().some((value) => directive.isSuggestionSelected(value))).toBe(
      false,
    );

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    input.dispatchEvent(enter);
    fixture.detectChanges();

    expect(enter.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.control.value).toBe('14:35');
    expect(input.value).toBe('14:35');
    expect(directive.suggestionsOpen()).toBe(false);
  });

  it('closes the list on Enter at the chosen row and leaves the key to the form', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const directive = directiveOf(fixture);
    const [first] = directive.suggestions();

    // Сетка начинается с самого значения: подсветка стоит на выбранной строке, менять нечего.
    expect(directive.suggestionText(first)).toBe('14:30');
    expect(directive.isSuggestionSelected(first)).toBe(true);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    input.dispatchEvent(enter);
    fixture.detectChanges();

    expect(enter.defaultPrevented).toBe(false);
    expect(fixture.componentInstance.control.value).toBe('14:30');
    expect(input.value).toBe('14:30');
    expect(directive.suggestionsOpen()).toBe(false);
  });

  it('closes on Escape and keeps the value', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    press(input, 'Escape');
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);
    expect(input.value).toBe('14:30');
  });

  it('closes on Tab without taking the active option', async () => {
    const { fixture, input } = await render(SuggestHost);
    fixture.componentInstance.control.setValue('14:30');
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(press(input, 'Tab')).toBe(true);
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);
    expect(input.value).toBe('14:30');
  });

  it('closes on blur', async () => {
    const { fixture, input } = await render(SuggestHost);
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(true);

    blur(input);
    fixture.detectChanges();
    expect(directiveOf(fixture).suggestionsOpen()).toBe(false);
  });

  it('selects a suggestion with the current format and cycle', async () => {
    const { fixture } = await render(SuggestHost);
    fixture.componentInstance.cycle.set('h12');
    fixture.detectChanges();
    const directive = directiveOf(fixture);

    directive.selectSuggestion({ hours: 14, minutes: 30, seconds: 0, milliseconds: 0 });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('02:30 PM');
    expect(fixture.componentInstance.control.value).toBe('14:30');
  });
});
