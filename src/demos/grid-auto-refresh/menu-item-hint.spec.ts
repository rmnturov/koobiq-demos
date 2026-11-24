import { FocusMonitor } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KbqDropdownModule } from '@koobiq/components/dropdown';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { vi } from 'vitest';
import { MenuItemHint } from './menu-item-hint';

@Component({
  imports: [KbqDropdownModule, KbqToolTipModule, MenuItemHint],
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
    });

    monitor.focusVia(items[0], 'keyboard');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(overlay.querySelector('[role="tooltip"]')?.textContent?.trim()).toBe(
        'Первая подсказка',
      );
      expect(overlay.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    });

    opener.focus();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(overlay.querySelector('[role="tooltip"]')).toBeNull();
    });
  });
});
