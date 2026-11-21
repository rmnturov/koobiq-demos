import { importProvidersFrom } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';
import { DateAdapter } from '@koobiq/components/core';
import { KbqTimepicker } from '@koobiq/components/timepicker';

import { TimeInputDirective } from '../../timepicker/time-input/time-input.directive';
import { LivePairComponent, LuxonTime } from './live-pair.component';

interface Rendered {
  fixture: ComponentFixture<LivePairComponent>;
  component: LivePairComponent;
  root: HTMLElement;
}

/**
 * Пара поднимается как есть: адаптер даты нужен старому таймпикеру, а больше ничего
 * снаружи не требуется — контролы внутри компонента, а не в хост-обёртке.
 */
function render(): Rendered {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [LivePairComponent],
    providers: [importProvidersFrom(KbqLuxonDateModule)],
  });

  const fixture = TestBed.createComponent(LivePairComponent);

  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    root: fixture.nativeElement as HTMLElement,
  };
}

/**
 * Значение старого поля — настоящий Luxon `DateTime`, собранный адаптером приложения:
 * у пакета `luxon` в проекте нет деклараций, а через адаптер оно приходит в том же виде,
 * в каком его отдаёт форма.
 */
function time(text: string): LuxonTime {
  // Адаптер приходит без параметра типа: пара знает про него ровно столько, сколько нужно.
  const adapter = TestBed.inject(DateAdapter) as DateAdapter<LuxonTime>;
  const value = adapter.parse(text, 'HH:mm');

  if (!value) {
    throw new Error(`Адаптер не разобрал время ${text}`);
  }

  return value;
}

describe('live pair', () => {
  it('keeps the two values independent', () => {
    const { component } = render();

    component.oldControl.setValue(time('09:15'));
    component.nextControl.setValue('18:45');

    expect(component.oldText()).toBe('09:15');
    expect(component.nextText()).toBe('18:45');
  });

  it('clears only the side that was asked', () => {
    const { component } = render();

    component.oldControl.setValue(time('09:00'));
    component.nextControl.setValue('18:45');

    component.clearOld();

    expect(component.oldText()).toBe('—');
    expect(component.nextText()).toBe('18:45');
  });

  it('shows the new field mask under the 24-hour cycle', () => {
    const { fixture, root } = render();
    const input = root.querySelector<HTMLInputElement>('[data-target="next"] input');

    // В покое маска скрыта: так ведёт себя само поле из демо `timepicker`.
    expect(input?.placeholder).toBe('');

    input?.focus();
    fixture.detectChanges();

    expect(input?.placeholder).toBe('ЧЧ:ММ');
  });

  it('takes what the user types in the new field into the fact line', async () => {
    const { fixture, component, root } = render();
    const input = root.querySelector<HTMLInputElement>('[data-target="next"] input')!;

    input.focus();
    input.value = '18:45';
    input.dispatchEvent(new Event('input'));

    // Поле правит вид и значение формы в отдельных тиках, а не в обработчике события.
    for (let tick = 0; tick < 3; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    fixture.detectChanges();

    expect(component.nextControl.value).toBe('18:45');
    expect(component.nextText()).toBe('18:45');
  });

  /*
   * Живая пара стоит на тех же серых плашках, что блоки сравнения: 480 × 300, зазор 2,
   * скруглены только внешние углы. Без фона она читалась бы как форма, а страница
   * показывала бы два разных примера подряд.
   */
  it('puts each side on the plate of the comparison blocks', () => {
    const { root } = render();
    const sides = [...root.querySelectorAll('.pair__side')];

    expect(sides.length).toBe(2);

    const styles = [...document.querySelectorAll('style')]
      .map((el) => el.textContent)
      .join('');

    expect(styles).toContain('var(--kbq-background-contrast-less)');
    expect(styles).toContain('height: 300px');
    expect(styles).toContain('border-radius: 12px 0 0 12px');
  });

  it('passes the same rejected-character tooltip to both controls', () => {
    const { fixture } = render();
    const old = fixture.debugElement.query(By.directive(KbqTimepicker)).injector.get(KbqTimepicker);
    const next = fixture.debugElement
      .query(By.directive(TimeInputDirective))
      .injector.get(TimeInputDirective);

    // Один и тот же триггер у обеих сторон: подсказка «Только цифры» — общий элемент, а не копия.
    expect(old.kbqValidationTooltip()).toBeDefined();
    expect(old.kbqValidationTooltip()).toBe(next.kbqValidationTooltip());
  });
});
