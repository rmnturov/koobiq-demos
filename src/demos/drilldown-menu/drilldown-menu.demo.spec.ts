import { installFocusLayout } from './testing/focus-layout';
installFocusLayout();
import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { findDemo } from '../demos.registry';
import { DrilldownMenuDemo } from './drilldown-menu.demo';

describe('drilldown menu demo', () => {
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
});
