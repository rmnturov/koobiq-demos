import { installFocusLayout } from '../testing/focus-layout';
installFocusLayout();
import { NgTemplateOutlet } from '@angular/common';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';
import { KBQ_ANIMATIONS_CONFIG } from '@koobiq/components/core';
import { DrilldownMenu } from './drilldown-menu';
import { DrilldownMenuScreen } from './drilldown-menu-screen';
import { DrilldownMenuList } from './drilldown-menu-list';

@Component({
  imports: [
    NgTemplateOutlet,
    DrilldownMenu,
    DrilldownMenuScreen,
    DrilldownMenuList,
    KbqDropdownItem,
  ],
  template: `<demo-drilldown-menu #menu="drilldownMenu">
      <ng-template drilldownMenuScreen="root" title="Root">
        <input id="custom" />
        <div drilldownMenuList><button kbq-dropdown-item id="open-child">Child</button></div>
      </ng-template>
      @if (showChild()) {
        <ng-template drilldownMenuScreen="child" title="Child" [screenWidth]="childWidth()">
          <div drilldownMenuList><button kbq-dropdown-item id="child-item">Item</button></div>
        </ng-template>
      }
      <ng-template drilldownMenuScreen="third" title="Third" initialFocus="#preferred">
        <input id="other" /><input type="hidden" id="hidden-form-field" /><button disabled>
          Unavailable</button
        ><textarea id="preferred"></textarea>
        <div drilldownMenuList><button kbq-dropdown-item id="form-list-item">Action</button></div>
      </ng-template>
    </demo-drilldown-menu>
    <ng-container [ngTemplateOutlet]="menu.panelTemplate() ?? null" />`,
})
class Host {
  readonly menu = viewChild.required(DrilldownMenu);
  readonly childWidth = signal(360);
  readonly showChild = signal(true);
}

describe('drilldown screens', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const menu = fixture.componentInstance.menu();
    menu.open();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, menu, root: fixture.nativeElement as HTMLElement };
  }

  it('retains parent content and restores focus across three levels', async () => {
    const { fixture, menu, root } = await render();
    const input = root.querySelector<HTMLInputElement>('#custom')!;
    input.value = 'custom';
    const opener = root.querySelector<HTMLElement>('#open-child')!;
    menu.navigate('child', opener);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('child');
    expect(root.querySelector('[data-screen="root"]')?.hasAttribute('inert')).toBe(true);
    menu.navigate('third', root.querySelector<HTMLElement>('#child-item')!);
    fixture.detectChanges();
    await fixture.whenStable();
    menu.back();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('child');
    menu.back();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('root');
    expect(root.querySelector<HTMLInputElement>('#custom')).toBe(input);
    expect(input.value).toBe('custom');
    expect(document.activeElement).toBe(opener);
    expect(
      fixture.debugElement.queryAll(By.directive(KbqScrollbarViewport)).length,
    ).toBeGreaterThan(0);
  });

  it('ignores unknown and current targets and clears visited views on closing', async () => {
    const { fixture, menu, root } = await render();
    menu.navigate('missing');
    menu.navigate('root');
    expect(menu.activeScreenId()).toBe('root');
    menu.close();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('#custom')).toBeNull();
    menu.open();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('root');
    expect(root.querySelector<HTMLInputElement>('#custom')?.value).toBe('');
  });

  it('reacts to screen width changes while open', async () => {
    const { fixture, menu, root } = await render();
    menu.navigate('child');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector<HTMLElement>('.drilldown-panel')!.style.width).toBe('360px');
    fixture.componentInstance.childWidth.set(400);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector<HTMLElement>('.drilldown-panel')!.style.width).toBe('400px');
  });

  it('respects an initial focus target in a custom form', async () => {
    const { fixture, menu } = await render();
    menu.navigate('third');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('preferred');
  });

  it('honors the Koobiq no-motion provider without delaying focus', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: KBQ_ANIMATIONS_CONFIG, useValue: { animationsDisabled: true } }],
    });
    const { fixture, menu, root } = await render();
    menu.navigate('child');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector<HTMLElement>('.drilldown-panel')!.style.transition).toBe('none');
    expect(document.activeElement?.id).toBe('child-item');
    expect(root.querySelector<HTMLElement>('[data-screen="root"]')!.hidden).toBe(true);
  });

  it('animates back to the right even when navigation had no opener', async () => {
    const { fixture, menu, root } = await render();
    menu.navigate('child');
    fixture.detectChanges();
    await fixture.whenStable();
    menu.back();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector<HTMLElement>('[data-screen="child"]')!.style.transform).toBe(
      'translateX(320px)',
    );
  });

  it('does not scroll the clipping panel horizontally while focusing a menu item', async () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    // jsdom has no layout: reproduce the browser's ancestor scrolling observed during the slide.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: function (this: HTMLElement) {
        const panel = this.closest<HTMLElement>('.drilldown-panel');
        if (panel) panel.scrollLeft = 316;
      },
    });
    try {
      const { fixture, menu, root } = await render();
      menu.navigate('child');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(root.querySelector<HTMLElement>('.drilldown-panel')!.scrollLeft).toBe(0);
      expect(document.activeElement?.id).toBe('child-item');
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('skips a removed intermediate screen when returning from its child', async () => {
    const { fixture, menu } = await render();
    menu.navigate('child');
    fixture.detectChanges();
    await fixture.whenStable();
    menu.navigate('third');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.showChild.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    menu.back();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('root');
  });

  it('skips hidden and disabled inputs in custom form tab navigation', async () => {
    const { fixture, menu, root } = await render();
    menu.navigate('third');
    fixture.detectChanges();
    await fixture.whenStable();
    root.querySelector<HTMLElement>('#other')!.focus();
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement?.id).toBe('preferred');
  });
});
