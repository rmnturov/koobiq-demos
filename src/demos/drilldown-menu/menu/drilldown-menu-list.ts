import { FocusKeyManager, FocusMonitor, InteractivityChecker } from '@angular/cdk/a11y';
import {
  afterEveryRender,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  Renderer2,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { kbqAnimationsDisabled } from '@koobiq/components/core';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqScrollbarViewport } from '@koobiq/components/scrollbar';

const HEADER_SCROLL_DURATION = 160;

function easeHeaderScroll(progress: number): number {
  let low = 0;
  let high = 1;
  let t = progress;

  for (let i = 0; i < 8; i++) {
    const inverse = 1 - t;
    const x = 3 * inverse * inverse * t * 0.23 + 3 * inverse * t * t * 0.32 + t * t * t;
    if (Math.abs(x - progress) < 0.001) break;
    if (x < progress) low = t;
    else high = t;
    t = (low + high) / 2;
  }

  const inverse = 1 - t;
  return 3 * inverse * inverse * t + 3 * inverse * t * t + t * t * t;
}

const lists = new WeakMap<HTMLElement, DrilldownMenuList>();
export function findDrilldownList(element: HTMLElement | null): DrilldownMenuList | undefined {
  return element ? lists.get(element) : undefined;
}

function getDrilldownContentInsets(target: HTMLElement): { top: number; bottom: number } {
  const content = target.closest<HTMLElement>('.drilldown-content');
  if (!content) return { top: 0, bottom: 0 };

  const style = getComputedStyle(content);
  return {
    top: Number.parseFloat(style.paddingTop) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
  };
}

export function revealDrilldownTarget(
  viewport: KbqScrollbarViewport | undefined,
  target: HTMLElement,
  options: { topGap?: number; behavior?: ScrollBehavior } = {},
): void {
  if (!viewport) return;
  const body = viewport.getNativeElement();
  const behavior = options.behavior ?? 'instant';
  if (options.topGap !== undefined) {
    viewport.scrollToElement(target, { top: options.topGap, behavior });
    return;
  }
  const bounds = body.getBoundingClientRect();
  const item = target.getBoundingClientRect();
  const insets = getDrilldownContentInsets(target);
  const scrollportTop = bounds.top + body.clientTop;
  const scrollportBottom = scrollportTop + body.clientHeight;
  if (item.top < scrollportTop + insets.top)
    viewport.scrollToElement(target, { top: insets.top, behavior });
  else if (item.bottom > scrollportBottom - insets.bottom)
    viewport.scrollToElement(target, {
      top: Math.max(0, body.clientHeight - target.offsetHeight - insets.bottom),
      behavior,
    });
}

class MenuOption {
  constructor(
    readonly item: KbqDropdownItem,
    private readonly checker: InteractivityChecker,
    private readonly focusTarget: () => void,
  ) {}
  get disabled() {
    const host = this.item.getHostElement();
    return (
      this.item.disabled() ||
      this.item.progress() ||
      host.matches(':disabled') ||
      !!host.closest('[inert]') ||
      !this.checker.isFocusable(host)
    );
  }
  focus() {
    this.focusTarget();
  }
}

@Directive({
  selector: '[drilldownMenuList]',
  exportAs: 'drilldownMenuList',
  host: {
    role: 'menu',
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocus($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class DrilldownMenuList {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);
  private readonly focusMonitor = inject(FocusMonitor);
  private readonly checker = inject(InteractivityChecker);
  private readonly injector = inject(Injector);
  private viewport?: KbqScrollbarViewport;
  private scrollFrame?: number;
  private readonly queried = contentChildren(KbqDropdownItem, { descendants: true });
  private readonly registered = signal<readonly KbqDropdownItem[]>([]);
  private readonly cache = new WeakMap<KbqDropdownItem, MenuOption>();
  private readonly options = computed(() => {
    const items = [...new Set([...this.queried(), ...this.registered()])]
      .filter((item) => item.getHostElement().closest('[drilldownMenuList]') === this.element)
      .sort((a, b) =>
        a.getHostElement().compareDocumentPosition(b.getHostElement()) &
        Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
    return items.map((item) => {
      let option = this.cache.get(item);
      if (!option) {
        option = new MenuOption(item, this.checker, () => {
          this.cancelScrollAnimation();
          this.focusMonitor.focusVia(item.getHostElement(), 'keyboard', { preventScroll: true });
          revealDrilldownTarget(this.viewport, item.getHostElement());
        });
        this.cache.set(item, option);
      }
      return option;
    });
  });
  private readonly manager = new FocusKeyManager(this.options, this.injector)
    .withVerticalOrientation()
    .withHomeAndEnd()
    .withWrap(false);
  private readonly activeId = signal<string | null>(null);
  private lastFocused: HTMLElement | null = null;

  constructor() {
    lists.set(this.element, this);
    afterEveryRender(() => this.sync());
    inject(DestroyRef).onDestroy(() => {
      this.cancelScrollAnimation();
      this.manager.destroy();
      lists.delete(this.element);
    });
  }

  registerItem(item: KbqDropdownItem): () => void {
    this.registered.update((items) => [...items, item]);
    return () => this.registered.update((items) => items.filter((value) => value !== item));
  }

  activeItemId(): string | null {
    return this.activeId();
  }

  setViewport(viewport: KbqScrollbarViewport | undefined): void {
    this.viewport = viewport;
  }

  scrollToStart(): void {
    const options = this.options();
    const firstVisible = options.find((option) =>
      this.checker.isVisible(option.item.getHostElement()),
    );
    if (!firstVisible) return;

    const firstFocusable = options.find((option) => !option.disabled);
    if (firstFocusable)
      this.focusMonitor.focusVia(firstFocusable.item.getHostElement(), 'keyboard', {
        preventScroll: true,
      });

    this.scrollToElement(
      firstVisible.item.getHostElement(),
      getDrilldownContentInsets(firstVisible.item.getHostElement()).top,
    );
  }

  focusInitial(selector?: string): void {
    const option =
      this.options().find(
        (value) => !value.disabled && !!selector && value.item.getHostElement().matches(selector),
      ) ??
      (!selector
        ? this.options().find(
            (value) => !value.disabled && value.item.getHostElement().id === this.activeId(),
          )
        : undefined) ??
      this.options().find((value) => !value.disabled);
    if (option) this.manager.setActiveItem(option);
    else this.element.focus({ preventScroll: true });
    this.sync();
  }

  focusItem(id: string): boolean {
    const option = this.options().find(
      (value) => !value.disabled && value.item.getHostElement().id === id,
    );
    if (!option) return false;
    this.manager.setActiveItem(option);
    this.sync();
    return true;
  }

  onFocus(event: FocusEvent): void {
    const option = this.options().find((value) => value.item.getHostElement() === event.target);
    if (option && !option.disabled) {
      this.cancelScrollAnimation();
      this.lastFocused = option.item.getHostElement();
      this.activeId.set(option.item.getHostElement().id);
      this.manager.updateActiveItem(option);
      this.sync();
    }
  }

  onFocusOut(event: FocusEvent): void {
    if (event.relatedTarget instanceof Node && this.element.contains(event.relatedTarget)) return;
    this.cancelScrollAnimation();
  }

  onKeydown(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !this.options().some((value) => value.item.getHostElement() === event.target)
    )
      return;
    if (event.key === 'PageUp') {
      event.preventDefault();
      this.manager.setFirstItemActive();
      this.sync();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    this.manager.onKeydown(event);
    this.sync();
  }

  private sync(): void {
    if (this.element.closest('[inert],[hidden]')) {
      this.cancelScrollAnimation();
      return;
    }
    const enabled = this.options().filter((option) => !option.disabled);
    const current =
      enabled.find((option) => option.item.getHostElement().id === this.activeId()) ?? enabled[0];
    const nextId = current?.item.getHostElement().id ?? null;
    const repairFocus =
      this.activeId() !== nextId &&
      (document.activeElement === this.element ||
        (this.lastFocused !== null &&
          (document.activeElement === this.lastFocused ||
            document.activeElement === document.body)));
    if (this.activeId() !== nextId) this.activeId.set(nextId);
    this.renderer.setAttribute(this.element, 'tabindex', current ? '-1' : '0');
    for (const option of this.options()) {
      this.renderer.setAttribute(
        option.item.getHostElement(),
        'tabindex',
        option === current ? '0' : '-1',
      );
    }
    if (current) this.manager.updateActiveItem(current);
    if (repairFocus) {
      if (current) current.focus();
      else this.element.focus({ preventScroll: true });
      this.lastFocused = current?.item.getHostElement() ?? null;
    }
  }

  private scrollToElement(target: HTMLElement, topGap = 0): void {
    const viewport = this.viewport;
    if (!viewport) return;

    this.cancelScrollAnimation();
    const body = viewport.getNativeElement();
    const start = body.scrollTop;
    const viewportTop = body.getBoundingClientRect().top;
    const targetTop = Math.max(
      0,
      Math.min(
        body.scrollHeight - body.clientHeight,
        start + target.getBoundingClientRect().top - viewportTop - body.clientTop - topGap,
      ),
    );
    if (Math.abs(targetTop - start) < 1) return;

    if (
      runInInjectionContext(this.injector, kbqAnimationsDisabled) ||
      typeof requestAnimationFrame === 'undefined'
    ) {
      viewport.scrollTo({ top: targetTop, behavior: 'instant' });
      return;
    }

    let startedAt: number | undefined;
    let lastScrollTop = start;
    const step = (now: number) => {
      if (Math.abs(body.scrollTop - lastScrollTop) > 1) {
        this.scrollFrame = undefined;
        return;
      }

      startedAt ??= now;
      const progress = Math.min((now - startedAt) / HEADER_SCROLL_DURATION, 1);
      const easedProgress = easeHeaderScroll(progress);
      viewport.scrollTo({
        top: start + (targetTop - start) * easedProgress,
        behavior: 'instant',
      });
      lastScrollTop = body.scrollTop;

      if (progress < 1) this.scrollFrame = requestAnimationFrame(step);
      else this.scrollFrame = undefined;
    };
    this.scrollFrame = requestAnimationFrame(step);
  }

  private cancelScrollAnimation(): void {
    if (this.scrollFrame === undefined) return;
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = undefined;
  }
}
