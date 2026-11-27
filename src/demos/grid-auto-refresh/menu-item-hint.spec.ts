import { FocusMonitor } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KbqDropdownModule } from '@koobiq/components/dropdown';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { vi } from 'vitest';
import { MenuHintGroup, MenuHintRoot, MenuItemHint } from './menu-item-hint';

@Component({
  imports: [KbqDropdownModule, KbqToolTipModule, MenuItemHint, MenuHintRoot],
  providers: [MenuHintGroup],
  template: `
    <button [kbqDropdownTriggerFor]="menu">Открыть</button>
    <kbq-dropdown #menu="kbqDropdown">
      <button
        kbq-dropdown-item
        kbqTooltip="Первая подсказка"
        kbqTrigger="hover"
        [kbqEnterDelay]="0"
      >
        Первый пункт
      </button>
      <button
        kbq-dropdown-item
        kbqTooltip="Вторая подсказка"
        kbqTrigger="hover"
        [kbqEnterDelay]="0"
      >
        Второй пункт
      </button>
      <button kbq-dropdown-item [kbqDropdownTriggerFor]="nested">Подменю</button>
    </kbq-dropdown>
    <kbq-dropdown #nested="kbqDropdown">
      <button kbq-dropdown-item kbqTooltip="Вложенная подсказка" kbqTrigger="hover">
        Вложенный пункт
      </button>
    </kbq-dropdown>
  `,
})
class HintTestMenu {}

describe('menu item explanations', () => {
  it('shows the focused item hint after native focus monitoring restarts and hides it on blur', async () => {
    const fixture = TestBed.createComponent(HintTestMenu);
    fixture.detectChanges();
    await fixture.whenStable();
    const opener = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const items = overlay.querySelectorAll<HTMLButtonElement>('[kbq-dropdown-item]');
    const monitor = TestBed.inject(FocusMonitor);

    monitor.focusVia(items[1], 'keyboard');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(overlay.querySelector('[role="tooltip"]')?.textContent?.trim()).toBe(
        'Вторая подсказка',
      );
      expect(items[1].getAttribute('aria-describedby')).toBeTruthy();
      expect(
        overlay.querySelector('[role="tooltip"]')?.classList.contains('grid-menu-hint-instant'),
      ).toBe(false);
    });

    monitor.focusVia(items[0], 'keyboard');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(overlay.querySelector('[role="tooltip"]')?.textContent?.trim()).toBe(
        'Первая подсказка',
      );
      expect(overlay.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
      expect(
        overlay.querySelector('[role="tooltip"]')?.classList.contains('grid-menu-hint-instant'),
      ).toBe(true);
    });

    opener.focus();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(overlay.querySelector('[role="tooltip"]')).toBeNull();
    });

    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const reopened = overlay.querySelector<HTMLButtonElement>('[kbq-dropdown-item]')!;
    monitor.focusVia(reopened, 'keyboard');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        overlay.querySelector('[role="tooltip"]')?.classList.contains('grid-menu-hint-instant'),
      ).toBe(false);
    });
  });

  it('keeps hover hints and nested menu hints in the same animation group', async () => {
    const fixture = TestBed.createComponent(HintTestMenu);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const items = overlay.querySelectorAll<HTMLButtonElement>('[kbq-dropdown-item]');

    items[0].dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      const hint = overlay.querySelector('[role="tooltip"]');
      expect(hint?.textContent?.trim()).toBe('Первая подсказка');
      expect(hint?.classList.contains('kbq-tooltip_visible')).toBe(true);
      expect(hint?.classList.contains('grid-menu-hint-instant')).toBe(false);
    });

    items[0].dispatchEvent(new MouseEvent('mouseleave'));
    items[1].dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      const hint = overlay.querySelector('[role="tooltip"]');
      expect(hint?.textContent?.trim()).toBe('Вторая подсказка');
      expect(hint?.classList.contains('grid-menu-hint-instant')).toBe(true);
    });

    items[1].dispatchEvent(new MouseEvent('mouseleave'));
    items[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    const nested = overlay.querySelector<HTMLButtonElement>('[kbqTooltip="Вложенная подсказка"]')!;
    TestBed.inject(FocusMonitor).focusVia(nested, 'keyboard');
    await vi.waitFor(() => {
      fixture.detectChanges();
      const hint = overlay.querySelector('[role="tooltip"]');
      expect(hint?.textContent?.trim()).toBe('Вложенная подсказка');
      expect(hint?.classList.contains('grid-menu-hint-instant')).toBe(true);
      expect(overlay.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    });
  });
});
