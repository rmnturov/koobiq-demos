import { NgTemplateOutlet } from '@angular/common';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';
import { DrilldownMenu } from './drilldown-menu';
import { DrilldownMenuScreen } from './drilldown-menu-screen';
import { DrilldownMenuList } from './drilldown-menu-list';

@Component({
  imports: [NgTemplateOutlet, DrilldownMenu, DrilldownMenuScreen, DrilldownMenuList, KbqDropdownItem],
  template: `<demo-drilldown-menu #menu="drilldownMenu">
    <ng-template drilldownMenuScreen="root" title="Root">
      <input id="custom" />
      <div drilldownMenuList><button kbq-dropdown-item id="open-child">Child</button></div>
    </ng-template>
    <ng-template drilldownMenuScreen="child" title="Child">
      <div drilldownMenuList><button kbq-dropdown-item id="child-item">Item</button></div>
    </ng-template>
    <ng-template drilldownMenuScreen="third" title="Third"><p>Empty</p></ng-template>
  </demo-drilldown-menu>
  <ng-container [ngTemplateOutlet]="menu.panelTemplate() ?? null" />`,
})
class Host { readonly menu = viewChild.required(DrilldownMenu); }

describe('drilldown screens', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges(); await fixture.whenStable();
    const menu = fixture.componentInstance.menu();
    menu.open(); fixture.detectChanges(); await fixture.whenStable();
    return { fixture, menu, root: fixture.nativeElement as HTMLElement };
  }

  it('retains parent content and restores focus across three levels', async () => {
    const { fixture, menu, root } = await render();
    const input = root.querySelector<HTMLInputElement>('#custom')!;
    input.value = 'custom';
    const opener = root.querySelector<HTMLElement>('#open-child')!;
    menu.navigate('child', opener); fixture.detectChanges(); await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('child');
    expect(root.querySelector('[data-screen="root"]')?.hasAttribute('inert')).toBe(true);
    menu.navigate('third', root.querySelector<HTMLElement>('#child-item')!);
    fixture.detectChanges(); await fixture.whenStable();
    menu.back(); fixture.detectChanges(); await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('child');
    menu.back(); fixture.detectChanges(); await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('root');
    expect(root.querySelector<HTMLInputElement>('#custom')).toBe(input);
    expect(input.value).toBe('custom');
    expect(document.activeElement).toBe(opener);
    expect(fixture.debugElement.queryAll(By.directive(KbqScrollbarViewport)).length).toBeGreaterThan(0);
  });

  it('ignores unknown and current targets and clears visited views on closing', async () => {
    const { fixture, menu, root } = await render();
    menu.navigate('missing'); menu.navigate('root');
    expect(menu.activeScreenId()).toBe('root');
    menu.close(); fixture.detectChanges(); await fixture.whenStable();
    expect(root.querySelector('#custom')).toBeNull();
    menu.open(); fixture.detectChanges(); await fixture.whenStable();
    expect(menu.activeScreenId()).toBe('root');
    expect(root.querySelector<HTMLInputElement>('#custom')?.value).toBe('');
  });
});
