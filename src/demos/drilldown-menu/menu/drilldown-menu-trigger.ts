import { InteractivityChecker } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  ViewContainerRef,
} from '@angular/core';
import { DrilldownMenu } from './drilldown-menu';

@Directive({
  selector: 'button[drilldownMenuTriggerFor]',
  host: {
    '[attr.aria-expanded]': 'menu().isOpen()',
    '[attr.aria-controls]': 'menu().isOpen() ? menu().id : null',
    'aria-haspopup': 'dialog',
    '(click)': 'toggle()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class DrilldownMenuTrigger {
  readonly menu = input.required<DrilldownMenu>({ alias: 'drilldownMenuTriggerFor' });
  private readonly origin = inject<ElementRef<HTMLButtonElement>>(ElementRef).nativeElement;
  private readonly overlay = inject(Overlay);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly checker = inject(InteractivityChecker);
  private overlayRef?: OverlayRef;
  private fallback: HTMLElement | null = null;

  constructor() {
    effect((onCleanup) => {
      const menu = this.menu();
      const open = () => this.open();
      menu.attachPanel = open;
      const subscription = menu.closed.subscribe((reason) => {
        this.overlayRef?.detach();
        menu.portalAttached = false;
        if (reason === 'escape' || reason === 'action') this.restoreFocus();
      });
      onCleanup(() => {
        subscription.unsubscribe();
        if (menu.attachPanel === open) menu.attachPanel = null;
      });
    });
    inject(DestroyRef).onDestroy(() => {
      // Angular can destroy the portal view before this directive, leaving focus on body.
      const restore =
        this.menu().isOpen() &&
        (document.activeElement === document.body ||
          (!!document.activeElement && this.menu().ownsTarget(document.activeElement)));
      this.menu().close('destroy');
      this.overlayRef?.dispose();
      this.menu().portalAttached = false;
      if (restore && this.fallback?.isConnected && this.checker.isFocusable(this.fallback))
        this.fallback.focus({ preventScroll: true });
    });
  }

  toggle(): void {
    if (this.menu().isOpen()) this.close();
    else this.open();
  }

  open(): void {
    const menu = this.menu();
    const template = menu.panelTemplate();
    if (menu.isOpen() || !template) return;
    if (!this.overlayRef) {
      const position = this.overlay
        .position()
        .flexibleConnectedTo(this.origin)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
        ])
        .withViewportMargin(8)
        .withFlexibleDimensions(false)
        .withPush(true);
      this.overlayRef = this.overlay.create({
        positionStrategy: position,
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
      });
      this.overlayRef.outsidePointerEvents().subscribe((event) => {
        const target = event.target;
        if (target instanceof Node && !this.origin.contains(target) && !menu.ownsTarget(target))
          menu.close('outside');
      });
      this.overlayRef.keydownEvents().subscribe((event) => {
        if (
          event.target instanceof Node &&
          menu.panelElement()?.nativeElement.contains(event.target)
        )
          menu.onKeydown(event);
      });
    }
    const pageStops = this.pageTabStops();
    this.fallback =
      pageStops[pageStops.indexOf(this.origin) + 1] ??
      pageStops[pageStops.indexOf(this.origin) - 1] ??
      null;
    menu.origin = this.origin;
    menu.updatePosition = () => this.overlayRef?.updatePosition();
    this.overlayRef.attach(new TemplatePortal(template, this.viewContainer));
    menu.portalAttached = true;
    menu.open();
    if (!menu.isOpen()) {
      this.overlayRef.detach();
      menu.portalAttached = false;
    }
  }

  close(): void {
    this.menu().close('action');
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' || event.defaultPrevented) return;
    event.preventDefault();
    this.open();
  }

  private pageTabStops(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'),
    ).filter(
      (element) =>
        !element.closest('.cdk-overlay-container,[inert],[hidden]') &&
        this.checker.isFocusable(element) &&
        this.checker.isTabbable(element),
    );
  }

  private restoreFocus(): void {
    const target = this.origin.isConnected ? this.origin : this.fallback;
    target?.focus({ preventScroll: true });
  }
}
