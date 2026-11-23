import { installFocusLayout } from './testing/focus-layout';
installFocusLayout();
import { OverlayContainer } from '@angular/cdk/overlay';
import { FocusMonitor } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { findDemo } from '../demos.registry';
import { DrilldownMenuDemo } from './drilldown-menu.demo';

describe('drilldown menu demo', () => {
  it('shows the header button name in a tooltip on keyboard focus', async () => {
    const fixture = TestBed.createComponent(DrilldownMenuDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[data-menu-trigger]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const focusMonitor = TestBed.inject(FocusMonitor);
    const expectHint = async (name: string) => {
      const button = overlay.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
      focusMonitor.focusVia(button, 'keyboard');
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(overlay.querySelector('[role="tooltip"]')?.textContent?.trim()).toBe(name);
      });
    };
    await expectHint('Справка');
    overlay.querySelector<HTMLElement>('[data-refresh-trigger]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await expectHint('Назад');
    await expectHint('Сбросить период обновления');
    expect(overlay.querySelector('.drilldown-panel')).not.toBeNull();
  });

  it('registers a working demo and refreshes without the optional section', async () => {
    expect(findDemo('drilldown-menu')?.title).toBe('Меню с переходами');
    const fixture = TestBed.createComponent(DrilldownMenuDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    host.includeAutoRefresh.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('[data-menu-trigger]') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('[data-refresh-trigger]')).toBeNull();
    overlay.querySelector<HTMLElement>('[data-refresh-now]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.refreshCount()).toBe(1);
    expect(overlay.querySelector('.drilldown-panel')).toBeNull();
  });

  it('reorders and removes a ready section without modifying the container', async () => {
    const fixture = TestBed.createComponent(DrilldownMenuDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    host.autoRefreshAfter.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('[data-menu-trigger]') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const refresh = overlay.querySelector<HTMLElement>('[data-refresh-now]')!;
    const section = overlay.querySelector<HTMLElement>('[data-refresh-trigger]')!;
    expect(
      refresh.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(overlay.querySelectorAll('[role="menu"] button[tabindex="0"]')).toHaveLength(1);
    section.click();
    fixture.detectChanges();
    await fixture.whenStable();
    overlay.querySelector<HTMLElement>('[data-period="60000"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.period()).toBe(60000);
    expect(document.activeElement?.hasAttribute('data-refresh-trigger')).toBe(true);
  });

  async function setupIncidentFields() {
    const fixture = TestBed.createComponent(DrilldownMenuDemo);
    const sync = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const press = (target: Element, key: string, shiftKey = false) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
      );
    await sync();
    const trigger = fixture.nativeElement.querySelector('[data-menu-trigger]') as HTMLButtonElement;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    trigger.click();
    await sync();
    const opener = overlay.querySelector<HTMLButtonElement>(
      '[data-drilldown-target="incident-fields"]',
    )!;
    expect(opener).not.toBeNull();
    expect(opener.textContent).toContain('Мультивыбор с поиском');
    const openFields = async () => {
      opener.click();
      await sync();
      return overlay.querySelector<HTMLInputElement>('[role="combobox"]')!;
    };
    const search = await openFields();
    const filter = async (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sync();
    };
    return { sync, trigger, overlay, opener, openFields, search, filter, press };
  }

  it('filters and toggles incident fields from one Tab stop', async () => {
    const { sync, overlay, search, filter, press } = await setupIncidentFields();
    expect(document.activeElement).toBe(search);
    const list = document.getElementById(search.getAttribute('aria-controls')!)!;
    expect(list.getAttribute('aria-multiselectable')).toBe('true');

    await filter(search, 'дАтА');
    const highlighted = Array.from(list.querySelectorAll('mark'), (mark) => mark.textContent);
    expect(highlighted).toEqual(['Дата', 'Дата', 'Дата']);
    expect(list.querySelectorAll('[role="group"]')).toHaveLength(2);
    expect(press(search, ' ')).toBe(true);
    const activeOption = () =>
      document.getElementById(search.getAttribute('aria-activedescendant')!);
    press(search, 'ArrowDown');
    await sync();
    const first = activeOption()!;
    expect(first.textContent).toContain('Дата обнаружения');
    expect(first.getAttribute('aria-checked')).toBe('false');
    press(search, 'Enter');
    press(search, 'ArrowDown');
    await sync();
    const second = activeOption()!;
    expect(second.textContent).toContain('Дата регистрации');
    press(search, 'Enter');
    await sync();
    expect(first.getAttribute('aria-checked')).toBe('true');
    expect(second.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(search);

    press(search, 'Tab');
    expect(document.activeElement?.textContent?.trim()).toBe('Сбросить по умолчанию');
    press(document.activeElement!, 'Tab', true);
    expect(document.activeElement).toBe(search);
    await filter(search, '[');
    expect(search.hasAttribute('aria-activedescendant')).toBe(false);
    expect(list.querySelector('[role="option"]')).toBeNull();
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(overlay.querySelector('[role="status"]')?.textContent?.trim()).toBe('Ничего не найдено');
  });

  it('preserves selection across menu sessions and can reset it', async () => {
    const { sync, trigger, overlay, opener, openFields, search, filter, press } =
      await setupIncidentFields();
    const closedDate = () =>
      Array.from(overlay.querySelectorAll<HTMLElement>('[role="option"]')).find(
        (option) => option.textContent?.trim() === 'Дата закрытия',
      )!;
    await filter(search, 'закрытия');
    closedDate().click();
    await sync();
    expect(closedDate().getAttribute('aria-checked')).toBe('true');
    press(search, 'Escape');
    await sync();
    expect(document.activeElement).toBe(opener);
    expect((await openFields()).value).toBe('закрытия');
    press(search, 'Escape');
    await sync();
    press(opener, 'Escape');
    await sync();
    trigger.click();
    await sync();
    overlay.querySelector<HTMLButtonElement>('[data-drilldown-target="incident-fields"]')!.click();
    await sync();
    const reopened = overlay.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(reopened.value).toBe('');
    expect(closedDate().getAttribute('aria-checked')).toBe('true');
    await filter(reopened, 'закрытия');
    overlay.querySelector<HTMLButtonElement>('[data-incident-fields-reset]')!.click();
    await sync();
    expect(reopened.value).toBe('');
    expect(closedDate().getAttribute('aria-checked')).toBe('false');
  });
});
