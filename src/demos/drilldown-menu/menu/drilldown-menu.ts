import { NgTemplateOutlet } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, forwardRef, inject, Injector, input, output, signal, TemplateRef, viewChild } from '@angular/core';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';
import { findDrilldownList } from './drilldown-menu-list';
import type { DrilldownMenuScreen } from './drilldown-menu-screen';
import { DRILLDOWN_MENU, DrilldownCloseReason, DrilldownFrame } from './drilldown-menu.types';

interface VisitedScreen { id: string; definition: DrilldownMenuScreen; }

@Component({
  selector: 'demo-drilldown-menu',
  exportAs: 'drilldownMenu',
  imports: [NgTemplateOutlet, KbqButtonModule, KbqIconModule, KbqScrollbarViewport],
  providers: [{ provide: DRILLDOWN_MENU, useExisting: forwardRef(() => DrilldownMenu) }],
  templateUrl: './drilldown-menu.html',
  styleUrl: './drilldown-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrilldownMenu {
  readonly rootScreen = input('root');
  readonly maxHeight = input(480);
  readonly width = input(320);
  readonly opened = output<void>();
  readonly closed = output<DrilldownCloseReason>();
  readonly isOpen = signal(false);
  readonly activeScreenId = signal<string | null>(null);
  readonly visited = signal<readonly VisitedScreen[]>([]);
  readonly depth = signal(0);
  readonly panelTemplate = viewChild<TemplateRef<unknown>>('panelTemplate');
  readonly panelElement = viewChild<ElementRef<HTMLElement>>('panelElement');
  readonly resolvedMaxHeight = computed(() => this.positive(this.maxHeight(), 480));
  readonly resolvedWidth = computed(() => this.positive(this.width(), 320));
  private readonly injector = inject(Injector);
  private readonly screens = new Map<string, DrilldownMenuScreen>();
  private stack: DrilldownFrame[] = [];
  private renderVersion = 0;

  constructor() { inject(DestroyRef).onDestroy(() => this.close('destroy')); }

  registerScreen(id: string, screen: DrilldownMenuScreen): void {
    if (this.screens.has(id) && this.screens.get(id) !== screen) throw new Error(`Duplicate drilldown screen: ${id}`);
    this.screens.set(id, screen);
  }

  unregisterScreen(id: string, screen: DrilldownMenuScreen): void {
    if (this.screens.get(id) !== screen) return;
    this.screens.delete(id);
    this.visited.update(items => items.filter(item => item.id !== id));
    if (this.isOpen() && this.activeScreenId() === id) {
      this.stack = this.stack.filter(frame => this.screens.has(frame.id));
      const parent = this.stack.at(-1);
      if (parent) this.show(parent.id);
      else this.close('action');
    }
  }

  open(): void {
    if (this.isOpen() || !this.screens.has(this.rootScreen())) return;
    this.isOpen.set(true);
    this.stack = [{ id: this.rootScreen(), scrollTop: 0, activeItemId: null }];
    this.show(this.rootScreen());
    this.opened.emit();
  }

  navigate(id: string, opener?: HTMLElement): void {
    if (!this.isOpen() || !this.screens.has(id) || this.activeScreenId() === id) return;
    this.saveFrame();
    const previous = this.stack.findIndex(frame => frame.id === id);
    if (previous >= 0) this.stack = this.stack.slice(0, previous + 1);
    else this.stack.push({ id, opener, scrollTop: 0, activeItemId: null });
    this.show(id);
  }

  back(): void {
    if (this.stack.length < 2) return;
    this.saveFrame();
    const child = this.stack.pop()!;
    this.show(this.stack.at(-1)!.id, child.opener);
  }

  close(reason: DrilldownCloseReason = 'action'): void {
    if (!this.isOpen()) return;
    this.renderVersion++;
    this.isOpen.set(false);
    this.activeScreenId.set(null);
    this.stack = [];
    this.visited.set([]);
    this.depth.set(0);
    this.closed.emit(reason);
  }

  screenElement(id = this.activeScreenId()): HTMLElement | null {
    return Array.from(this.panelElement()?.nativeElement.querySelectorAll<HTMLElement>('[data-screen]') ?? [])
      .find(element => element.dataset['screen'] === id) ?? null;
  }

  private show(id: string, opener?: HTMLElement): void {
    const definition = this.screens.get(id)!;
    if (!this.visited().some(screen => screen.id === id)) this.visited.update(items => [...items, { id, definition }]);
    this.activeScreenId.set(id);
    this.depth.set(this.stack.length - 1);
    const version = ++this.renderVersion;
    afterNextRender(() => {
      if (version !== this.renderVersion || !this.isOpen()) return;
      const screen = this.screenElement(id);
      if (!screen) return;
      const body = screen.querySelector<HTMLElement>('[kbqScrollbarViewport]')!;
      const frame = this.stack.at(-1)!;
      body.scrollTop = frame.scrollTop;
      const list = findDrilldownList(body.querySelector<HTMLElement>('[drilldownMenuList]'));
      if (opener?.isConnected && !opener.matches(':disabled,[aria-disabled="true"]') && screen.contains(opener)) {
        opener.focus({ preventScroll: true });
      } else if (list) {
        if (!frame.activeItemId || !list.focusItem(frame.activeItemId)) list.focusInitial(definition.initialFocus());
      } else {
        (body.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') ?? screen).focus({ preventScroll: true });
      }
    }, { injector: this.injector });
  }

  private saveFrame(): void {
    const screen = this.screenElement();
    const frame = this.stack.at(-1);
    if (!screen || !frame) return;
    frame.scrollTop = screen.querySelector<HTMLElement>('[kbqScrollbarViewport]')?.scrollTop ?? 0;
    frame.activeItemId = findDrilldownList(screen.querySelector<HTMLElement>('[drilldownMenuList]'))?.activeItemId() ?? null;
  }

  private positive(value: number, fallback: number): number { return Number.isFinite(value) && value > 0 ? value : fallback; }
}
