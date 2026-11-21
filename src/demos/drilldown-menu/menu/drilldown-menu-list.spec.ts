import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { DrilldownMenuList } from './drilldown-menu-list';

@Component({
  imports: [KbqDropdownItem, DrilldownMenuList],
  template: `<div drilldownMenuList>
    @if (showFirst()) { <button kbq-dropdown-item id="first" [disabled]="disabled()">First</button> }
    <button kbq-dropdown-item id="second" disabled>Second</button>
    <button kbq-dropdown-item id="third" [disabled]="disabled()">Third</button>
  </div>`,
})
class Host {
  readonly disabled = signal(false);
  readonly showFirst = signal(true);
  readonly list = viewChild.required(DrilldownMenuList);
}

describe('drilldown list', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const stops = () => Array.from(root.querySelectorAll<HTMLElement>('[tabindex="0"]')).map(el => el.id);
    const key = (key: string) => {
      const keyCode = ({ ArrowDown: 40, ArrowUp: 38, Home: 36, End: 35 } as Record<string, number>)[key];
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    return { fixture, root, stops, key, host: fixture.componentInstance };
  }

  it('owns one tab stop across renders and skips disabled items', async () => {
    const { fixture, host, stops, key } = await render();
    expect(stops()).toEqual(['first']);
    host.list().focusInitial();
    key('ArrowDown');
    expect(document.activeElement?.id).toBe('third');
    fixture.detectChanges();
    expect(stops()).toEqual(['third']);
    key('ArrowDown');
    expect(document.activeElement?.id).toBe('third');
    key('Home');
    expect(document.activeElement?.id).toBe('first');
    key('End');
    expect(document.activeElement?.id).toBe('third');
  });

  it('repairs the tab stop after removal, disabling and pointer focus', async () => {
    const { fixture, host, root, stops } = await render();
    root.querySelector<HTMLElement>('#third')!.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(stops()).toEqual(['third']);
    host.list().focusItem('first');
    host.showFirst.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(stops()).toEqual(['third']);
    expect(document.activeElement?.id).toBe('third');
    host.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector('[drilldownMenuList]')?.getAttribute('tabindex')).toBe('0');
    expect(root.querySelectorAll('button[tabindex="0"]')).toHaveLength(0);
    expect(document.activeElement).toBe(root.querySelector('[drilldownMenuList]'));
  });
});
