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
    expect(findDemo('drilldown-menu')?.title).toBe('Меню настройки грида');
    const fixture = TestBed.createComponent(DrilldownMenuDemo);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Меню настройки грида');
    expect(element.querySelector('#menu-max-height[kbqNumberInput]')).not.toBeNull();
    expect(element.querySelector('kbq-skeleton-table')).not.toBeNull();
    expect(element.querySelector('.kbq-skeleton-table__cell_pinned-edge')).toBeNull();
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

  async function setupRootMenu() {
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
    return { sync, trigger, overlay, press };
  }

  async function setupIncidentFields() {
    const { sync, trigger, overlay, press } = await setupRootMenu();
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
    const back = overlay.querySelector<HTMLButtonElement>(
      '[data-screen="incident-fields"] button[aria-label="Назад"]',
    )!;
    const closedDate = () =>
      Array.from(overlay.querySelectorAll<HTMLElement>('[role="option"]')).find(
        (option) => option.textContent?.trim() === 'Дата закрытия',
      )!;
    await filter(search, 'закрытия');
    closedDate().click();
    await sync();
    expect(closedDate().getAttribute('aria-checked')).toBe('true');
    back.click();
    await sync();
    expect(document.activeElement).toBe(opener);
    expect((await openFields()).value).toBe('закрытия');
    back.click();
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

  it('keeps the active incident field when a space is typed in the empty search', async () => {
    const { sync, overlay, search, filter, press } = await setupIncidentFields();
    press(search, 'ArrowDown');
    await sync();
    const activeId = search.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();

    await filter(search, ' ');

    expect(search.value).toBe(' ');
    expect(search.getAttribute('aria-activedescendant')).toBe(activeId);
    expect(overlay.querySelector('.incident-option_active')?.id).toBe(activeId);

    press(search, 'Escape');
    await sync();
    expect(search.value).toBe('');
    expect(document.activeElement).toBe(search);
  });

  it('clears the query with Escape before returning to the parent menu', async () => {
    const { sync, overlay, opener, search, filter, press } = await setupIncidentFields();
    await filter(search, 'критичность');
    expect(overlay.querySelectorAll('[role="option"]')).toHaveLength(1);

    press(search, 'Escape');
    await sync();
    expect(document.activeElement).toBe(search);
    expect(search.value).toBe('');
    expect(overlay.querySelectorAll('[role="option"]')).toHaveLength(18);

    press(search, 'Escape');
    await sync();
    expect(document.activeElement).toBe(opener);
  });

  it('clears the query and every selection from the header action', async () => {
    const { sync, overlay, search, filter, press } = await setupIncidentFields();
    await filter(search, 'критичность');
    expect(overlay.querySelector('[role="option"]')?.getAttribute('aria-checked')).toBe('true');

    const clear = overlay.querySelector<HTMLButtonElement>(
      'header button[aria-label="Очистить выбор и поиск"]',
    );
    expect(clear).not.toBeNull();
    press(search, 'Tab', true);
    expect(document.activeElement).toBe(clear);
    clear!.click();
    await sync();

    expect(search.value).toBe('');
    expect(overlay.querySelectorAll('[role="option"]')).toHaveLength(18);
    expect(overlay.querySelector('[role="option"][aria-checked="true"]')).toBeNull();
  });

  it('focuses the search and selects its full query when the heading is clicked', async () => {
    const { overlay, search, filter, press } = await setupIncidentFields();
    await filter(search, 'дата обнаружения');
    search.setSelectionRange(5, 5);
    press(search, 'Tab');
    expect(document.activeElement).not.toBe(search);

    const heading = overlay.querySelector<HTMLElement>(
      '[data-screen="incident-fields"] .drilldown-heading',
    )!;
    heading.click();

    expect(document.activeElement).toBe(search);
    expect(search.selectionStart).toBe(0);
    expect(search.selectionEnd).toBe(search.value.length);
    expect(search.value).toBe('дата обнаружения');
  });

  it('leaves only the final example disabled and closes the menu after command activation', async () => {
    const { sync, trigger, overlay } = await setupRootMenu();
    const root = overlay.querySelector<HTMLElement>('[data-screen="root"]')!;
    const items = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    const disabled = items.filter((item) => item.disabled);
    expect(disabled).toEqual([items.at(-1)]);
    expect(disabled[0].querySelector('.drilldown-submenu-caption')?.textContent).toContain(
      'Стандартный',
    );
    expect(disabled[0].querySelector('.drilldown-submenu-chevron')).not.toBeNull();

    const commands = [
      'Перенос по словам',
      'Обновить',
      'Столбцы по содержимому',
      'Свернуть группы',
      'Развернуть группы',
      'Полноэкранный режим',
    ];
    for (const [index, name] of commands.entries()) {
      if (index > 0) {
        trigger.click();
        await sync();
      }
      const command = Array.from(overlay.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
        .find((item) => item.textContent?.trim() === name)!;
      expect(command.disabled).toBe(false);
      command.click();
      await sync();
      expect(overlay.querySelector('.drilldown-panel')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    }
  });

  it('offers three density choices and updates the parent caption', async () => {
    const { sync, overlay } = await setupRootMenu();
    const opener = overlay.querySelector<HTMLButtonElement>('[data-drilldown-target="density"]')!;
    expect(opener?.textContent).toContain('Средняя');
    opener.click();
    await sync();
    const screen = overlay.querySelector<HTMLElement>('[data-screen="density"]')!;
    const options = Array.from(screen.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Низкая', 'Средняя', 'Высокая',
    ]);
    expect(document.activeElement).toBe(options[1]);
    options[2].click();
    await sync();
    expect(opener.textContent).toContain('Высокая');
    expect(document.activeElement).toBe(opener);
    opener.click();
    await sync();
    screen.querySelector<HTMLButtonElement>('[aria-label="Сбросить плотность"]')!.click();
    await sync();
    expect(options[1].getAttribute('aria-checked')).toBe('true');
  });

  it('shows independent field selections and uses a total only for columns', async () => {
    const { sync, overlay } = await setupRootMenu();
    const item = (id: string) =>
      overlay.querySelector<HTMLButtonElement>(`[data-drilldown-target="${id}"]`)!;
    const caption = (id: string) =>
      item(id)?.querySelector('.drilldown-submenu-caption')?.textContent?.trim();
    expect(caption('columns')).toBe('3 из 18');
    expect(caption('incident-fields')).toBe('3');
    expect(caption('sorting')).toBe('Узел источника');
    expect(caption('grouping')).toBeUndefined();

    item('incident-fields').click();
    await sync();
    const screen = overlay.querySelector<HTMLElement>('[data-screen="incident-fields"]')!;
    screen.querySelector<HTMLButtonElement>('[aria-label="Очистить выбор и поиск"]')!.click();
    await sync();
    const options = Array.from(screen.querySelectorAll<HTMLElement>('[role="option"]'));
    options.find((option) => option.textContent?.trim() === 'Критичность')!.click();
    await sync();
    expect(caption('incident-fields')).toBe('Критичность');
    options.find((option) => option.textContent?.trim() === 'Состояние')!.click();
    await sync();
    expect(caption('incident-fields')).toBe('2');
    expect(caption('columns')).toBe('3 из 18');
    expect(caption('grouping')).toBeUndefined();
  });
});
