import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { DrilldownMenu } from './drilldown-menu';
import { DrilldownMenuScreen } from './drilldown-menu-screen';
import { DrilldownMenuList } from './drilldown-menu-list';
import { DrilldownMenuTrigger } from './drilldown-menu-trigger';

@Component({
  imports: [
    DrilldownMenu,
    DrilldownMenuScreen,
    DrilldownMenuList,
    DrilldownMenuTrigger,
    KbqDropdownItem,
  ],
  template: `<button id="before">Before</button
    ><button id="trigger" [drilldownMenuTriggerFor]="menu">Open</button
    ><button id="after">After</button>
    <demo-drilldown-menu #menu="drilldownMenu">
      <ng-template drilldownMenuScreen="root" title="Root" let-api>
        <div drilldownMenuList>
          <button
            kbq-dropdown-item
            id="child-opener"
            data-drilldown-target="child"
            (click)="api.navigate('child', $any($event.currentTarget))"
          >
            Child
          </button>
        </div>
      </ng-template>
      <ng-template #actions><button id="reset">Reset</button></ng-template>
      <ng-template drilldownMenuScreen="child" title="Child" [headerActions]="actions">
        <div drilldownMenuList><button kbq-dropdown-item id="choice">Choice</button></div>
        <input id="editor" />
      </ng-template>
    </demo-drilldown-menu>`,
})
class Host {
  readonly menu = viewChild.required(DrilldownMenu);
}

describe('drilldown overlay and focus', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(20);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20);
  });
  afterEach(() => vi.restoreAllMocks());
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('#trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const menu = fixture.componentInstance.menu();
    const key = async (key: string, shiftKey = false, prevent = false) => {
      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      if (prevent) event.preventDefault();
      document.activeElement!.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, overlay, menu, key, trigger };
  }

  it('uses one overlay and returns through levels with Escape', async () => {
    const { fixture, overlay, menu, key, trigger } = await render();
    expect(document.activeElement?.id).toBe('child-opener');
    await key('ArrowRight');
    expect(menu.activeScreenId()).toBe('child');
    expect(document.activeElement?.id).toBe('choice');
    expect(overlay.querySelectorAll('.cdk-overlay-pane')).toHaveLength(1);
    await key('Escape', false, true);
    expect(menu.activeScreenId()).toBe('child');
    await key('Escape');
    expect(document.activeElement?.id).toBe('child-opener');
    await key('Escape');
    expect(menu.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    fixture.destroy();
    expect(overlay.querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
  });

  it('keeps header tab order and leaves the portal relative to the trigger', async () => {
    const { fixture, menu, overlay, key } = await render();
    await key('ArrowRight');
    await key('Tab', true);
    expect(document.activeElement?.id).toBe('reset');
    await key('Tab', true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Назад');
    await key('Tab', true);
    expect(menu.isOpen()).toBe(false);
    expect(document.activeElement?.id).toBe('before');
    (fixture.nativeElement.querySelector('#trigger') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    await key('Tab');
    expect(menu.isOpen()).toBe(false);
    expect(document.activeElement?.id).toBe('after');
    expect(overlay.querySelector('.drilldown-panel')).toBeNull();
  });
});
