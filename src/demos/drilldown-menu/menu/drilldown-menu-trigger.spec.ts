import { installFocusLayout } from '../testing/focus-layout';
installFocusLayout();
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal, viewChild } from '@angular/core';
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
  template: `<button id="before">Before</button>
    @if (showTrigger()) {
      <button id="trigger" [drilldownMenuTriggerFor]="menu">Open</button>
    }
    <input type="hidden" id="hidden-page-field" /><button id="after">After</button>
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
        <div drilldownMenuList>
          <button kbq-dropdown-item id="choice">Choice</button
          ><button kbq-dropdown-item id="other-choice">Other</button>
        </div>
        <input id="editor" />
      </ng-template>
    </demo-drilldown-menu>`,
})
class Host {
  readonly menu = viewChild.required(DrilldownMenu);
  readonly showTrigger = signal(true);
}

describe('drilldown overlay and focus', () => {
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

  it('cycles Tab in both directions through the header, menu and custom controls', async () => {
    const { menu, overlay, key } = await render();
    await key('ArrowRight');
    await key('Tab', true);
    expect(document.activeElement?.id).toBe('reset');
    await key('Tab', true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Назад');
    await key('Tab', true);
    expect(document.activeElement?.id).toBe('editor');
    expect(menu.isOpen()).toBe(true);
    await key('Tab');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Назад');
    await key('Tab');
    expect(document.activeElement?.id).toBe('reset');
    await key('Tab');
    expect(document.activeElement?.id).toBe('choice');
    await key('Tab');
    expect(document.activeElement?.id).toBe('editor');
    await key('Tab');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Назад');
    expect(menu.isOpen()).toBe(true);
    expect(
      overlay.querySelector('[role="menu"]')?.querySelectorAll('button[tabindex="0"]'),
    ).toHaveLength(1);
  });

  it('keeps focus inside a menu with a single tab stop', async () => {
    const { menu, key } = await render();
    await key('Tab');
    expect(document.activeElement?.id).toBe('child-opener');
    await key('Tab', true);
    expect(document.activeElement?.id).toBe('child-opener');
    expect(menu.isOpen()).toBe(true);
  });

  it('attaches the portal when opened through the public menu API', async () => {
    const { fixture, menu, overlay } = await render();
    menu.close();
    fixture.detectChanges();
    await fixture.whenStable();
    menu.open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.querySelector('.drilldown-panel')).not.toBeNull();
    expect(document.activeElement?.id).toBe('child-opener');
  });

  it('restores the fallback when Angular destroys the trigger of a focused panel', async () => {
    const { fixture, menu } = await render();
    fixture.componentInstance.showTrigger.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menu.isOpen()).toBe(false);
    expect(document.activeElement?.id).toBe('after');
  });

  it('ignores stationary hover while rows slide under the pointer', async () => {
    const { fixture, overlay, key } = await render();
    await key('ArrowRight');
    const other = overlay.querySelector<HTMLElement>('#other-choice')!;
    other.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100 }));
    fixture.detectChanges();
    expect(document.activeElement?.id).toBe('choice');
    other.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 110, clientY: 100 }),
    );
    other.dispatchEvent(new MouseEvent('mouseenter', { clientX: 110, clientY: 100 }));
    fixture.detectChanges();
    expect(document.activeElement?.id).toBe('other-choice');
  });
});
