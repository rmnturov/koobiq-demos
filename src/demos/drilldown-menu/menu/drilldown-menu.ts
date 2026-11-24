import { NgTemplateOutlet } from '@angular/common';
import { FocusMonitor, InteractivityChecker } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  viewChildren,
} from '@angular/core';
import { kbqAnimationsDisabled } from '@koobiq/components/core';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';
import { findDrilldownList, revealDrilldownTarget } from './drilldown-menu-list';
import type { DrilldownMenuScreen } from './drilldown-menu-screen';
import { DRILLDOWN_MENU, DrilldownCloseReason, DrilldownFrame } from './drilldown-menu.types';
import { DrilldownTransition } from './drilldown-menu-transition';

const INITIAL_MENU_ITEM_TOP_GAP = 80;

interface VisitedScreen {
  id: string;
  definition: DrilldownMenuScreen;
}
let nextMenuId = 0;

@Component({
  selector: 'demo-drilldown-menu',
  exportAs: 'drilldownMenu',
  imports: [NgTemplateOutlet, KbqButtonModule, KbqIconModule, KbqToolTipModule, KbqScrollbarViewport],
  providers: [{ provide: DRILLDOWN_MENU, useExisting: forwardRef(() => DrilldownMenu) }],
  templateUrl: './drilldown-menu.html',
  styleUrl: './drilldown-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrilldownMenu {
  readonly id = `drilldown-menu-${nextMenuId++}`;
  origin: HTMLElement | null = null;
  updatePosition: () => void = () => {};
  attachPanel: (() => void) | null = null;
  portalAttached = false;
  readonly rootScreen = input('root');
  readonly maxHeight = input(480);
  readonly width = input(320);
  readonly opened = output<void>();
  readonly closed = output<DrilldownCloseReason>();
  readonly isOpen = signal(false);
  readonly activeScreenId = signal<string | null>(null);
  readonly visited = signal<readonly VisitedScreen[]>([]);
  readonly activeTitle = computed(
    () =>
      this.visited()
        .find((screen) => screen.id === this.activeScreenId())
        ?.definition.title() ?? 'Параметры таблицы',
  );
  readonly depth = signal(0);
  readonly panelTemplate = viewChild<TemplateRef<unknown>>('panelTemplate');
  readonly panelElement = viewChild<ElementRef<HTMLElement>>('panelElement');
  readonly resolvedMaxHeight = computed(() => this.positive(this.maxHeight(), 480));
  readonly resolvedWidth = computed(() => this.positive(this.width(), 320));
  private readonly injector = inject(Injector);
  private readonly checker = inject(InteractivityChecker);
  private readonly focusMonitor = inject(FocusMonitor);
  private readonly scrollbars = viewChildren(KbqScrollbarViewport);
  private readonly screens = new Map<string, DrilldownMenuScreen>();
  private stack: DrilldownFrame[] = [];
  private renderVersion = 0;
  private readonly transition = new DrilldownTransition();
  private readonly motionDisabled = kbqAnimationsDisabled();
  private observer?: ResizeObserver;
  private lastSize = { width: 0, height: 0 };
  private hoverLocked = false;
  private pointerPosition: { x: number; y: number } | null = null;
  private guardedPanel: HTMLElement | null = null;
  private readonly guardHover = (event: MouseEvent) => {
    if (
      !this.hoverLocked ||
      !(event.target instanceof HTMLElement) ||
      !event.target.matches('[kbq-dropdown-item]')
    )
      return;
    this.pointerPosition ??= { x: event.clientX, y: event.clientY };
    event.stopImmediatePropagation();
  };

  constructor() {
    const resize = () => this.resizeCurrent();
    const pointerMove = (event: PointerEvent) => {
      const moved =
        this.pointerPosition &&
        (event.clientX !== this.pointerPosition.x || event.clientY !== this.pointerPosition.y);
      this.pointerPosition = { x: event.clientX, y: event.clientY };
      if (!moved || !this.hoverLocked) return;
      this.hoverLocked = false;
      const target =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>('[kbq-dropdown-item]')
          : null;
      if (
        target &&
        this.screenElement()?.contains(target) &&
        !target.classList.contains('kbq-progress') &&
        this.checker.isFocusable(target)
      ) {
        this.focusMonitor.focusVia(target, 'mouse', { preventScroll: true });
      }
    };
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', pointerMove, { passive: true });
    effect(() => {
      this.maxHeight();
      this.width();
      const definition = this.visited().find(
        (screen) => screen.id === this.activeScreenId(),
      )?.definition;
      definition?.screenWidth();
      definition?.allowTriggerOverlap();
      afterNextRender(resize, { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => {
      this.transition.destroy();
      this.observer?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointerMove);
      this.guardedPanel?.removeEventListener('mouseenter', this.guardHover, true);
      this.close('destroy');
    });
  }

  registerScreen(id: string, screen: DrilldownMenuScreen): void {
    if (this.screens.has(id) && this.screens.get(id) !== screen)
      throw new Error(`Duplicate drilldown screen: ${id}`);
    this.screens.set(id, screen);
  }

  unregisterScreen(id: string, screen: DrilldownMenuScreen): void {
    if (this.screens.get(id) !== screen) return;
    this.screens.delete(id);
    this.stack = this.stack.filter((frame) => this.screens.has(frame.id));
    this.depth.set(Math.max(0, this.stack.length - 1));
    this.visited.update((items) => items.filter((item) => item.id !== id));
    if (this.isOpen() && this.activeScreenId() === id) {
      const parent = this.stack.at(-1);
      if (parent) this.show(parent.id, undefined, 'back');
      else this.close('action');
    }
  }

  open(): void {
    if (this.isOpen() || !this.screens.has(this.rootScreen())) return;
    if (this.attachPanel && !this.portalAttached) {
      this.attachPanel();
      return;
    }
    this.isOpen.set(true);
    this.stack = [{ id: this.rootScreen(), scrollTop: 0, activeItemId: null }];
    this.show(this.rootScreen());
    this.opened.emit();
  }

  navigate(id: string, opener?: HTMLElement): void {
    if (!this.isOpen() || !this.screens.has(id) || this.activeScreenId() === id) return;
    this.saveFrame();
    const previous = this.stack.findIndex((frame) => frame.id === id);
    if (previous >= 0) this.stack = this.stack.slice(0, previous + 1);
    else this.stack.push({ id, opener, scrollTop: 0, activeItemId: null });
    this.show(id, undefined, previous >= 0 ? 'back' : 'forward');
  }

  back(): void {
    if (this.stack.length < 2) return;
    this.saveFrame();
    const child = this.stack.pop()!;
    this.show(this.stack.at(-1)!.id, child.opener, 'back');
  }

  close(reason: DrilldownCloseReason = 'action'): void {
    if (!this.isOpen()) return;
    this.renderVersion++;
    this.transition.destroy();
    this.observer?.disconnect();
    this.guardedPanel?.removeEventListener('mouseenter', this.guardHover, true);
    this.guardedPanel = null;
    this.hoverLocked = false;
    this.isOpen.set(false);
    this.activeScreenId.set(null);
    this.stack = [];
    this.visited.set([]);
    this.depth.set(0);
    if (reason !== 'destroy') this.closed.emit(reason);
  }

  screenElement(id = this.activeScreenId()): HTMLElement | null {
    return (
      Array.from(
        this.panelElement()?.nativeElement.querySelectorAll<HTMLElement>('[data-screen]') ?? [],
      ).find((element) => element.dataset['screen'] === id) ?? null
    );
  }

  onHeadingClick(id: string): void {
    if (id === this.rootScreen()) return;
    const screen = this.screenElement(id);
    if (!screen) return;
    const viewport = this.viewportFor(screen);
    const listElement = screen.querySelector<HTMLElement>('[drilldownMenuList]');
    const list = findDrilldownList(listElement ?? null);
    if (list) {
      list.setViewport(viewport);
      list.scrollToStart();
      return;
    }

    const selector = this.screens.get(id)?.initialFocus();
    const search = selector
      ? screen.querySelector('.drilldown-before-content')?.querySelector(selector)
      : null;
    if (!(search instanceof HTMLInputElement) || !this.checker.isFocusable(search)) return;

    search.focus({ preventScroll: true });
    search.select();
    this.revealTarget(search);
    if (viewport?.getNativeElement().scrollTop) {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      viewport.scrollToTop(this.motionDisabled || reduceMotion ? 'instant' : 'smooth');
    }
  }

  scrollInitialFocusTarget(id: string, behavior: ScrollBehavior = 'instant'): void {
    const selector = this.screens.get(id)?.initialFocus();
    const screen = this.screenElement(id);
    const target = selector ? screen?.querySelector<HTMLElement>(selector) : null;
    if (!screen || !target?.matches('[kbq-dropdown-item]')) return;
    const viewport = this.viewportFor(screen);
    if (!viewport?.getNativeElement().contains(target)) return;
    revealDrilldownTarget(viewport, target, {
      topGap: INITIAL_MENU_ITEM_TOP_GAP,
      behavior,
    });
  }

  revealTarget(target: HTMLElement): void {
    const screen = this.screenElement();
    if (!screen?.contains(target)) return;
    const viewport = this.viewportFor(screen);
    if (viewport?.getNativeElement().contains(target)) revealDrilldownTarget(viewport, target);

    // A very short panel can also scroll its fixed controls into view.
    if (screen.scrollHeight > screen.clientHeight) {
      const screenBounds = screen.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      if (targetBounds.top < screenBounds.top) {
        screen.scrollTop += targetBounds.top - screenBounds.top;
      } else if (targetBounds.bottom > screenBounds.bottom) {
        screen.scrollTop += targetBounds.bottom - screenBounds.bottom;
      }
    }
  }

  ownsTarget(target: Node): boolean {
    const panel = this.panelElement()?.nativeElement;
    if (!panel) return false;
    if (panel.contains(target)) return true;
    return Array.from(panel.querySelectorAll<HTMLElement>('[aria-controls],[aria-owns]')).some(
      (owner) => {
        const ids =
          `${owner.getAttribute('aria-controls') ?? ''} ${owner.getAttribute('aria-owns') ?? ''}`
            .trim()
            .split(/\s+/);
        return ids.some((id) => !!id && !!document.getElementById(id)?.contains(target));
      },
    );
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !this.screenElement()?.contains(target)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.depth()) this.back();
      else this.close('escape');
    } else if (event.key === 'Tab') {
      const screen = this.screenElement()!;
      const stops = Array.from(
        screen.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'),
      ).filter(
        (element) =>
          !element.closest('[inert],[hidden]') &&
          this.checker.isFocusable(element) &&
          this.checker.isTabbable(element),
      );
      const index = stops.indexOf(target);
      const next =
        index < 0
          ? event.shiftKey
            ? stops.at(-1)
            : stops[0]
          : stops[(index + (event.shiftKey ? stops.length - 1 : 1)) % stops.length];
      event.preventDefault();
      event.stopPropagation();
      (next ?? screen).focus({ preventScroll: true });
      if (next) this.revealTarget(next);
    } else if (target.matches('[kbq-dropdown-item]') && target.closest('[drilldownMenuList]')) {
      if (event.key === 'ArrowLeft' && this.depth()) {
        event.preventDefault();
        event.stopPropagation();
        this.back();
      } else if (event.key === 'ArrowRight' && target.dataset['drilldownTarget']) {
        event.preventDefault();
        event.stopPropagation();
        this.navigate(target.dataset['drilldownTarget'], target);
      }
    }
  }

  private show(id: string, opener?: HTMLElement, direction: 'forward' | 'back' = 'forward'): void {
    const previousId = this.activeScreenId();
    const definition = this.screens.get(id);
    if (!definition) return;
    this.hoverLocked = true;
    if (!this.visited().some((screen) => screen.id === id))
      this.visited.update((items) => [...items, { id, definition }]);
    this.activeScreenId.set(id);
    this.depth.set(this.stack.length - 1);
    const version = ++this.renderVersion;
    afterNextRender(
      () => {
        if (version !== this.renderVersion || !this.isOpen()) return;
        const screen = this.screenElement(id);
        if (!screen) return;
        const panel = this.panelElement()!.nativeElement;
        if (this.guardedPanel !== panel) {
          this.guardedPanel?.removeEventListener('mouseenter', this.guardHover, true);
          this.guardedPanel = panel;
          panel.addEventListener('mouseenter', this.guardHover, true);
        }
        this.layout(screen, this.screenElement(previousId), direction);
        const body = screen.querySelector<HTMLElement>('[kbqScrollbarViewport]')!;
        const frame = this.stack.at(-1)!;
        body.scrollTop = frame.scrollTop;
        const list = findDrilldownList(body.querySelector<HTMLElement>('[drilldownMenuList]'));
        const viewport = this.viewportFor(screen);
        list?.setViewport(viewport);
        const selector = definition.initialFocus();
        const preferred = selector ? screen.querySelector<HTMLElement>(selector) : null;
        if (
          opener?.isConnected &&
          !opener.matches(':disabled,[aria-disabled="true"]') &&
          screen.contains(opener)
        ) {
          opener.focus({ preventScroll: true });
        } else if (
          preferred &&
          !preferred.matches('[kbq-dropdown-item]') &&
          this.checker.isFocusable(preferred)
        ) {
          preferred.focus({ preventScroll: true });
        } else if (list) {
          if (!frame.activeItemId || !list.focusItem(frame.activeItemId))
            list.focusInitial(definition.initialFocus());
        } else {
          const focusTarget = preferred && this.checker.isFocusable(preferred) ? preferred : null;
          (
            focusTarget ??
            Array.from(
              body.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
              ),
            ).find((element) => this.checker.isFocusable(element)) ??
            screen.querySelector<HTMLElement>('header button:not(:disabled)') ??
            screen
          ).focus({ preventScroll: true });
        }
        if (document.activeElement instanceof HTMLElement && screen.contains(document.activeElement)) {
          const active = document.activeElement;
          const isInitialMenuItem = preferred === active && active.matches('[kbq-dropdown-item]');
          if (isInitialMenuItem) this.scrollInitialFocusTarget(id);
          else this.revealTarget(active);
        }
        this.observer?.disconnect();
        if (typeof ResizeObserver !== 'undefined') {
          this.observer ??= new ResizeObserver(() => this.resizeCurrent());
          const content = screen.querySelector('.drilldown-content');
          if (content) this.observer.observe(content);
        }
      },
      { injector: this.injector },
    );
  }

  private viewportFor(screen: HTMLElement): KbqScrollbarViewport | undefined {
    return this.scrollbars().find((viewport) => screen.contains(viewport.getNativeElement()));
  }

  private resizeCurrent(): void {
    const screen = this.screenElement();
    if (screen && this.isOpen()) this.layout(screen, screen, 'forward', true);
  }

  private layout(
    screen: HTMLElement,
    from: HTMLElement | null,
    direction: 'forward' | 'back',
    onlyIfChanged = false,
  ): void {
    const panel = this.panelElement()?.nativeElement;
    const definition = this.screens.get(this.activeScreenId()!);
    if (!panel || !definition) return;
    const targetWidth = Math.max(
      1,
      Math.min(
        this.positive(definition.screenWidth() ?? this.resolvedWidth(), 320),
        window.innerWidth - 16,
      ),
    );
    screen.style.width = `${targetWidth}px`;
    const chromeHeight =
      (screen.querySelector<HTMLElement>('.drilldown-header')?.offsetHeight ?? 40) +
      (screen.querySelector<HTMLElement>('.drilldown-before-content')?.offsetHeight ?? 0) +
      (screen.querySelector<HTMLElement>('.drilldown-footer')?.offsetHeight ?? 0);
    const maxHeight = this.resolvedMaxHeight();
    const windowSpace = window.innerHeight - 16;
    if (definition.allowTriggerOverlap()) {
      const bodyHeightLimit = Math.max(0, Math.min(maxHeight, windowSpace) - chromeHeight);
      screen.style.setProperty('--drilldown-body-height-limit', `${bodyHeightLimit}px`);
    }
    const naturalHeight =
      chromeHeight +
      (screen.querySelector<HTMLElement>('.drilldown-content')?.scrollHeight ?? 0);
    const origin = this.origin?.getBoundingClientRect();
    let available = windowSpace;
    if (origin && !definition.allowTriggerOverlap()) {
      const below = available - origin.bottom;
      const above = origin.top - 16;
      available = naturalHeight <= below ? below : Math.max(below, above);
    }
    const targetHeight = Math.max(
      1,
      Math.min(naturalHeight || 40, maxHeight, available),
    );
    if (
      onlyIfChanged &&
      this.lastSize.width === targetWidth &&
      this.lastSize.height === targetHeight
    )
      return;
    this.lastSize = { width: targetWidth, height: targetHeight };
    screen.style.height = `${targetHeight}px`;
    this.transition.run({
      panel,
      from,
      to: screen,
      direction,
      targetWidth,
      targetHeight,
      disabled:
        this.motionDisabled ||
        !from ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      position: this.updatePosition,
      settled: () => {},
    });
    this.updatePosition();
  }

  private saveFrame(): void {
    const screen = this.screenElement();
    const frame = this.stack.at(-1);
    if (!screen || !frame) return;
    frame.scrollTop = screen.querySelector<HTMLElement>('[kbqScrollbarViewport]')?.scrollTop ?? 0;
    frame.activeItemId =
      findDrilldownList(screen.querySelector<HTMLElement>('[drilldownMenuList]'))?.activeItemId() ??
      null;
  }

  private positive(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
