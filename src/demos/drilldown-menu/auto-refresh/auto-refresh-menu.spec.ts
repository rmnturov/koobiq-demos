import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DrilldownMenu } from '../menu/drilldown-menu';
import { DrilldownMenuScreen } from '../menu/drilldown-menu-screen';
import { DrilldownMenuList } from '../menu/drilldown-menu-list';
import { DrilldownMenuTrigger } from '../menu/drilldown-menu-trigger';
import { AutoRefreshMenu, AutoRefreshPeriod, AutoRefreshPreset } from './auto-refresh-menu';

@Component({
  imports: [
    DrilldownMenu,
    DrilldownMenuScreen,
    DrilldownMenuList,
    DrilldownMenuTrigger,
    AutoRefreshMenu,
  ],
  template: `<button id="trigger" [drilldownMenuTriggerFor]="menu">Open</button>
    <demo-drilldown-menu #menu="drilldownMenu">
      <ng-template drilldownMenuScreen="root" title="Root">
        <div drilldownMenuList>
          <demo-auto-refresh-menu
            [(value)]="value"
            [presets]="presets()"
            [defaultValue]="defaultValue()"
            (valueChange)="changes.push($event)"
          />
        </div>
      </ng-template>
    </demo-drilldown-menu>`,
})
class Host {
  readonly menu = viewChild.required(DrilldownMenu);
  readonly value = signal<AutoRefreshPeriod>(300000);
  readonly defaultValue = signal<AutoRefreshPeriod | undefined>(300000);
  readonly presets = signal<readonly AutoRefreshPreset[]>([
    { value: 300000, label: '5 мин' },
    { value: 60000, label: '1 мин' },
  ]);
  readonly changes: AutoRefreshPeriod[] = [];
}

describe('auto refresh section', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    (fixture.nativeElement.querySelector('#trigger') as HTMLElement).click();
    await settle();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const open = async () => {
      overlay.querySelector<HTMLElement>('[data-refresh-trigger]')!.click();
      await settle();
    };
    return { fixture, host: fixture.componentInstance, overlay, settle, open };
  }

  it('selects a preset once, returns to root and restores the ready row focus', async () => {
    const { host, overlay, open, settle } = await render();
    expect(overlay.querySelectorAll('[data-screen="root"] button[tabindex="0"]')).toHaveLength(1);
    await open();
    expect(document.activeElement?.getAttribute('data-period')).toBe('300000');
    overlay.querySelector<HTMLElement>('[data-period="60000"]')!.click();
    await settle();
    expect(host.value()).toBe(60000);
    expect(host.changes).toEqual([60000]);
    expect(host.menu().isOpen()).toBe(true);
    expect(host.menu().activeScreenId()).toBe('root');
    expect(document.activeElement?.hasAttribute('data-refresh-trigger')).toBe(true);
    await open();
    overlay.querySelector<HTMLElement>('[data-period="off"]')!.click();
    await settle();
    expect(host.value()).toBeNull();
    expect(overlay.querySelector('[data-refresh-caption]')).toBeNull();
  });

  it('keeps reset in the child screen and supports resetting to off', async () => {
    const { host, overlay, open, settle } = await render();
    host.value.set(60000);
    host.defaultValue.set(null);
    await settle();
    await open();
    const reset = overlay.querySelector<HTMLButtonElement>('[data-refresh-reset]')!;
    reset.focus();
    reset.click();
    await settle();
    expect(host.value()).toBeNull();
    expect(host.menu().activeScreenId()).toBe('auto-refresh');
    expect(document.activeElement).toBe(reset);
    host.defaultValue.set(undefined);
    await settle();
    expect(overlay.querySelector('[data-refresh-reset]')).toBeNull();
  });

  it('preserves an unknown value through changing or empty presets', async () => {
    const { host, overlay, open, settle } = await render();
    host.value.set(45000);
    await settle();
    await open();
    expect(overlay.querySelectorAll('[aria-checked="true"]')).toHaveLength(0);
    host.presets.set([
      { value: 15000, label: 'Same' },
      { value: 30000, label: 'Same' },
      { value: 15000, label: 'Duplicate' },
    ]);
    await settle();
    expect(host.value()).toBe(45000);
    expect(overlay.querySelectorAll('[role="menuitemradio"]')).toHaveLength(3);
    host.presets.set([]);
    await settle();
    expect(overlay.querySelectorAll('[role="menuitemradio"]')).toHaveLength(1);
    expect(host.value()).toBe(45000);
  });
});
