import { FocusKeyManager } from '@angular/cdk/a11y';
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
  signal,
} from '@angular/core';
import { KbqDropdownItem } from '@koobiq/components/dropdown';

const lists = new WeakMap<HTMLElement, DrilldownMenuList>();
export function findDrilldownList(element: HTMLElement | null): DrilldownMenuList | undefined {
  return element ? lists.get(element) : undefined;
}

class MenuOption {
  constructor(readonly item: KbqDropdownItem) {}
  get disabled() {
    return this.item.disabled() || this.item.progress();
  }
  focus() {
    this.item.focus('keyboard');
  }
}

@Directive({
  selector: '[drilldownMenuList]',
  exportAs: 'drilldownMenuList',
  host: { role: 'menu', '(keydown)': 'onKeydown($event)', '(focusin)': 'onFocus($event)' },
})
export class DrilldownMenuList {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);
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
        option = new MenuOption(item);
        this.cache.set(item, option);
      }
      return option;
    });
  });
  private readonly manager = new FocusKeyManager(this.options, inject(Injector))
    .withVerticalOrientation()
    .withHomeAndEnd()
    .withWrap(false);
  private readonly activeId = signal<string | null>(null);
  private lastFocused: HTMLElement | null = null;

  constructor() {
    lists.set(this.element, this);
    afterEveryRender(() => this.sync());
    inject(DestroyRef).onDestroy(() => {
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

  focusInitial(selector?: string): void {
    const option =
      this.options().find(
        (value) => !value.disabled && !!selector && value.item.getHostElement().matches(selector),
      ) ??
      this.options().find(
        (value) => !value.disabled && value.item.getHostElement().id === this.activeId(),
      ) ??
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
      this.lastFocused = option.item.getHostElement();
      this.activeId.set(option.item.getHostElement().id);
      this.manager.updateActiveItem(option);
      this.sync();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      !this.options().some((value) => value.item.getHostElement() === event.target)
    )
      return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    this.manager.onKeydown(event);
    this.sync();
  }

  private sync(): void {
    const enabled = this.options().filter((option) => !option.disabled);
    const current =
      enabled.find((option) => option.item.getHostElement().id === this.activeId()) ?? enabled[0];
    const nextId = current?.item.getHostElement().id ?? null;
    const repairFocus =
      this.activeId() !== nextId &&
      this.lastFocused !== null &&
      (document.activeElement === this.lastFocused || document.activeElement === document.body) &&
      !this.element.closest('[inert]');
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
}
