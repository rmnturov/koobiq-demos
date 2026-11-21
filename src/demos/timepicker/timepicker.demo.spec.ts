import { ComponentFixture, TestBed } from '@angular/core/testing';
import { findDemo } from '../demos.registry';
import { readPickerSettings, TimepickerDemo, writePickerSettings } from './timepicker.demo';

/**
 * Поднимает демо на заданном query: настройки читаются в конструкторе, поэтому адрес
 * выставляется до создания компонента.
 */
async function render(search: string): Promise<ComponentFixture<TimepickerDemo>> {
  history.replaceState(null, '', `/${search}`);
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [TimepickerDemo] }).compileComponents();
  const fixture = TestBed.createComponent(TimepickerDemo);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return fixture;
}

const fieldInput = (el: HTMLElement): HTMLInputElement =>
  el.querySelector<HTMLInputElement>('[data-target="field"] input')!;

/**
 * Набор идёт клавишами: маска живёт в `keydown`, а запись `input.value` целиком — сырой путь,
 * на котором значение собирается разбором текста, а не посимвольно.
 */
const typeKeys = (input: HTMLInputElement, text: string): void => {
  for (const char of text) {
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }),
    );
  }
};

/**
 * Кнопка переключателя — внутренний `button` внутри `kbq-button-toggle`: обработчик клика живёт
 * на нём, клик по хосту до кнопки не доходит.
 */
const pressToggle = (el: HTMLElement, selector: string): void => {
  el.querySelector<HTMLButtonElement>(`${selector} button`)!.click();
};

describe('timepicker demo', () => {
  afterEach(() => {
    history.replaceState(null, '', '/');
  });

  it('reads known settings and falls back to defaults', () => {
    expect(readPickerSettings('?format=HH:mm:ss&cycle=h12')).toEqual({
      format: 'HH:mm:ss',
      cycle: 'h12',
    });
    expect(readPickerSettings('?format=nope&cycle=nope')).toEqual({
      format: 'HH:mm',
      cycle: 'h23',
    });
    expect(readPickerSettings('')).toEqual({ format: 'HH:mm', cycle: 'h23' });
  });

  it('writes settings with replaceState', () => {
    const replaceState = vi.fn();
    writePickerSettings({ format: 'HH:mm:ss.SSS', cycle: 'h12' }, {
      replaceState,
    } as unknown as History);
    expect(replaceState).toHaveBeenCalledWith(null, '', '?format=HH:mm:ss.SSS&cycle=h12');
  });

  it('focuses the field when the page opens', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    expect(document.activeElement).toBe(fieldInput(root));
  });

  it('renders the field with the mask of the settings from the URL', async () => {
    const { nativeElement } = await render('?format=HH:mm:ss&cycle=h12');
    expect(fieldInput(nativeElement).placeholder).toBe('ЧЧ:ММ:СС AM');
  });

  it('changes the format from the precision toggle', async () => {
    const fixture = await render('');
    pressToggle(fixture.nativeElement, '[data-format="HH:mm:ss.SSS"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fieldInput(fixture.nativeElement).placeholder).toBe('ЧЧ:ММ:СС.ССС');
  });

  it('selects toggles from the URL and writes the cycle back', async () => {
    const fixture = await render('?format=HH:mm:ss&cycle=h12');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-format="HH:mm:ss"]')!.classList.contains('kbq-selected')).toBe(
      true,
    );
    expect(root.querySelector('[data-cycle="h12"]')!.classList.contains('kbq-selected')).toBe(true);

    pressToggle(root, '[data-cycle="h23"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(location.search).toBe('?format=HH:mm:ss&cycle=h23');
    expect(root.querySelector('[data-cycle="h23"]')!.classList.contains('kbq-selected')).toBe(true);
  });

  it('clears the field from the demo button', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    typeKeys(fieldInput(root), '1430');
    fixture.detectChanges();
    expect(root.querySelector('[data-value]')!.textContent?.trim()).toBe('14:30');

    root.querySelector<HTMLButtonElement>('.demo__clear')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fieldInput(root).value).toBe('');
    expect(root.querySelector('[data-value]')!.textContent?.trim()).toBe('—');
    expect(document.activeElement).toBe(fieldInput(root));
  });

  it('shows the canonical value under the card', async () => {
    const fixture = await render('?format=HH:mm:ss');
    typeKeys(fieldInput(fixture.nativeElement), '143015');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const value = root.querySelector<HTMLElement>('[data-value]')!;
    const line = value.closest<HTMLElement>('.demo__value')!;
    const card = root.querySelector<HTMLElement>('.demo__card')!;

    expect(value.textContent?.trim()).toBe('14:30:15');
    expect(card.contains(value)).toBe(false);
    expect(card.contains(line)).toBe(false);
    expect(card.nextElementSibling).toBe(line);
  });

  it('shows the required error only after the submit attempt and keeps the button enabled', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const submit = root.querySelector<HTMLButtonElement>('[data-action="submit"]')!;

    expect(submit.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('.demo__clear')!.disabled).toBe(false);
    submit.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(submit.disabled).toBe(false);
    expect(root.querySelector('kbq-error')).toBeNull();
    expect(
      root.querySelector('[data-target="field"]')!.classList.contains('kbq-form-field_invalid'),
    ).toBe(true);
    expect(fieldInput(root).getAttribute('aria-invalid')).toBe('true');
  });

  it('switches every field icon to the error color when the field is invalid', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;

    for (const target of ['clock', 'clearable']) {
      root.querySelector<HTMLInputElement>(`[data-target="${target}"] input`)!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    root.querySelectorAll<HTMLInputElement>('kbq-toggle input')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    root.querySelector<HTMLInputElement>('[data-target="chevron"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = fieldInput(root);
    input.dispatchEvent(new Event('focus'));
    typeKeys(input, '2500');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      root.querySelector('[data-target="field"]')!.classList.contains('kbq-form-field_invalid'),
    ).toBe(true);
    expect(root.querySelector('.demo__clock')!.classList.contains('kbq-error')).toBe(true);
    expect(root.querySelector('.demo__clear-icon .kbq-icon')!.classList.contains('kbq-error')).toBe(
      true,
    );
    expect(root.querySelector('.demo__chevron .kbq-icon')!.classList.contains('kbq-error')).toBe(
      true,
    );
  });

  it('focuses the invalid field and selects the whole value on submit', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const input = fieldInput(root);

    input.dispatchEvent(new Event('focus'));
    typeKeys(input, '2500');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(input.value).toBe('25:00');
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('opens the time suggestions once they are enabled', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLInputElement>('kbq-toggle input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = fieldInput(root);
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(root.querySelector('.demo__suggestions')).not.toBeNull();
    expect(root.querySelector('.demo__suggestions .kbq-scrollbar-viewport')).not.toBeNull();
    expect(root.querySelector('.demo__suggestions')!.getAttribute('role')).toBeNull();

    const option = root.querySelector('.demo__suggestions kbq-option');

    expect(option).not.toBeNull();
    expect(option!.getAttribute('role')).toBe('option');
    expect(option!.classList).toContain('kbq-option');

    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the suggestions from the chevron without taking focus', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const input = fieldInput(root);

    input.focus();
    root.querySelector<HTMLInputElement>('kbq-toggle input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    root.querySelector<HTMLInputElement>('[data-target="chevron"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const chevron = root.querySelector<HTMLButtonElement>('.demo__chevron')!;

    expect(chevron.tabIndex).toBe(-1);
    expect(chevron.getAttribute('aria-hidden')).toBe('true');

    chevron.click();
    fixture.detectChanges();

    expect(root.querySelector('.demo__suggestions')).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('keeps the suggestions off until the toggle is on', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.demo__suggestions')).toBeNull();
    expect(root.querySelector('.demo__chevron')).toBeNull();
    expect(root.querySelector('[data-target="focus"]')).toBeNull();
    expect(fieldInput(root).getAttribute('role')).toBeNull();

    const toggle = root.querySelector<HTMLInputElement>('kbq-toggle input')!;

    toggle.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('[data-target="focus"]')).not.toBeNull();
    expect(root.querySelector('.demo__chevron')).toBeNull();
    expect(fieldInput(root).getAttribute('role')).toBe('combobox');

    toggle.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('.demo__suggestions')).toBeNull();
    expect(root.querySelector('.demo__chevron')).toBeNull();
    expect(fieldInput(root).getAttribute('role')).toBeNull();
  });

  it('combines the focus and chevron options', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const input = fieldInput(root);

    root.querySelector<HTMLInputElement>('kbq-toggle input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const chevronToggle = root.querySelector<HTMLInputElement>('[data-target="chevron"] input')!;

    // Шеврон — независимая опция: пока выключен, кнопки нет.
    expect(root.querySelector('.demo__chevron')).toBeNull();

    chevronToggle.click();
    fixture.detectChanges();
    expect(root.querySelector('.demo__chevron')).not.toBeNull();

    // Фокус можно отключить: поле получает фокус, но список не открывается.
    fixture.componentInstance.setOpenOnFocus(false);
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(root.querySelector('.demo__suggestions')).toBeNull();

    // Тогда список открывает шеврон.
    root.querySelector<HTMLButtonElement>('.demo__chevron')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.demo__suggestions')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('.demo__chevron')!.click();
    fixture.detectChanges();
    expect(root.querySelector('.demo__suggestions')).toBeNull();

    // Набор открывает список всегда и сразу фильтрует его по введенному тексту.
    typeKeys(input, '1');
    fixture.detectChanges();
    expect(root.querySelector('.demo__suggestions')).not.toBeNull();
  });

  it('filters the autocomplete list down to the typed value', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLInputElement>('kbq-toggle input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.setOpenOnFocus(false);
    fixture.detectChanges();

    typeKeys(fieldInput(root), '1430');
    fixture.detectChanges();

    const options = root.querySelectorAll('.demo__suggestions kbq-option');

    expect(options).toHaveLength(1);
    expect(options[0].textContent?.trim()).toBe('14:30');
  });

  it('shows the whole grid and marks the current option when a filled field gains focus', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const input = fieldInput(root);

    root.querySelector<HTMLInputElement>('kbq-toggle input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    typeKeys(input, '1430');
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const options = root.querySelectorAll('.demo__suggestions kbq-option');

    expect(options).toHaveLength(48);
    expect(options[0].textContent?.trim()).toBe('14:30');
    expect(options[0].classList).toContain('kbq-selected');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].classList).not.toContain('kbq-selected');
  });

  it('clears the field from the suffix cross without taking focus', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const field = root.querySelector('[data-target="field"]') as HTMLElement;
    const initialWidth = field.style.width;

    root.querySelector<HTMLInputElement>('[data-target="clearable"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('.demo__clear-icon')).toBeNull();
    expect(field.style.width).not.toBe(initialWidth);

    typeKeys(fieldInput(root), '1430');
    fixture.detectChanges();

    const cross = root.querySelector<HTMLButtonElement>('.demo__clear-icon')!;

    expect(cross).not.toBeNull();
    expect(cross.tabIndex).toBe(-1);
    expect(cross.getAttribute('aria-label')).toBe('Очистить поле');
    expect(cross.querySelector('.kbq-icon')!.className).toContain('kbq-xmark-circle_16');

    cross.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    cross.click();
    fixture.detectChanges();

    expect(fieldInput(root).value).toBe('');
    expect(root.querySelector('[data-value]')!.textContent?.trim()).toBe('—');
    expect(root.querySelector('.demo__clear-icon')).toBeNull();
    expect(document.activeElement).toBe(fieldInput(root));
    expect(fieldInput(root).selectionStart).toBe(0);
  });

  it('cancels the failed submit when the suffix cross clears the field', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const field = root.querySelector('[data-target="field"]') as HTMLElement;

    root.querySelector<HTMLInputElement>('[data-target="clearable"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(field.classList.contains('kbq-form-field_invalid')).toBe(true);

    typeKeys(fieldInput(root), '1430');
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.demo__clear-icon')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fieldInput(root).value).toBe('');
    expect(root.querySelector('[data-value]')!.textContent?.trim()).toBe('—');
    expect(field.classList.contains('kbq-form-field_invalid')).toBe(false);
  });

  it('shows a decorative clock icon when the option is on', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const field = root.querySelector('[data-target="field"]') as HTMLElement;
    const initialWidth = field.style.width;

    root.querySelector<HTMLInputElement>('[data-target="clock"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const clock = root.querySelector('.demo__clock');

    expect(clock).not.toBeNull();
    expect(clock!.getAttribute('aria-hidden')).toBe('true');
    expect(field.style.width).not.toBe(initialWidth);

    typeKeys(fieldInput(root), '1430');
    fixture.detectChanges();

    expect(fieldInput(root).value).toBe('14:30');
  });

  it('closes the list first and clears on the second Escape', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const input = fieldInput(root);

    root.querySelector<HTMLInputElement>('kbq-toggle input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    root.querySelector<HTMLInputElement>('[data-target="clearable"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    typeKeys(input, '1430');
    fixture.detectChanges();
    expect(root.querySelector('.demo__suggestions')).not.toBeNull();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(root.querySelector('.demo__suggestions')).toBeNull();
    expect(input.value).toBe('14:30');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(input.value).toBe('');
    expect(root.querySelector('[data-value]')!.textContent?.trim()).toBe('—');
  });

  it('matches the design widths per precision and addons', async () => {
    const fixture = await render('?format=HH:mm:ss.SSS&cycle=h23');
    const root = fixture.nativeElement as HTMLElement;
    const field = root.querySelector('[data-target="field"]') as HTMLElement;

    expect(field.style.width).toBe('128px');

    root.querySelector<HTMLInputElement>('[data-target="clock"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(field.style.width).toBe('156px');

    root.querySelector<HTMLInputElement>('[data-target="clearable"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(field.style.width).toBe('200px');
  });

  it('widens the field when the chevron needs room for the text', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    const field = root.querySelector('[data-target="field"]') as HTMLElement;

    expect(field.style.width).toBe('80px');

    root.querySelector<HTMLInputElement>('kbq-toggle input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    root.querySelector<HTMLInputElement>('[data-target="chevron"] input')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(field.style.width).toBe('108px');
  });

  it('submits a filled valid time', async () => {
    const fixture = await render('');
    const root = fixture.nativeElement as HTMLElement;
    typeKeys(fieldInput(root), '1430');
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('[data-action="submit"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('[data-sent]')?.textContent).toContain('14:30');
    expect(root.querySelector('kbq-error')).toBeNull();
  });

  it('is registered in the catalog', () => {
    expect(findDemo('timepicker')?.title).toBe('Таймпикер');
  });
});
