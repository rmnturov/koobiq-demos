import { FocusMonitor } from '@angular/cdk/a11y';
import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injectable,
} from '@angular/core';
import { KbqDropdownTrigger } from '@koobiq/components/dropdown';
import { KbqTooltipTrigger } from '@koobiq/components/tooltip';

const INSTANT_HINT_CLASS = 'grid-menu-hint-instant';

@Injectable()
export class MenuHintGroup {
  hasShown = false;

  reset() {
    this.hasShown = false;
  }
}

@Directive({ selector: '[kbqDropdownTriggerFor]:not([kbq-dropdown-item])' })
export class MenuHintRoot {
  constructor() {
    const group = inject(MenuHintGroup);
    const closed = inject(KbqDropdownTrigger).dropdownClosed.subscribe(() => group.reset());
    inject(DestroyRef).onDestroy(() => closed.unsubscribe());
  }
}

@Directive({ selector: '[kbq-dropdown-item][kbqTooltip]' })
export class MenuItemHint {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef);
    const tooltip = inject(KbqTooltipTrigger);
    const focusMonitor = inject(FocusMonitor);
    const destroy = inject(DestroyRef);
    const group = inject(MenuHintGroup);
    let enterDelay: number | undefined;
    const prepare = () => {
      if (tooltip.isOpen) return;
      enterDelay ??= tooltip.enterDelay;
      tooltip.enterDelay = group.hasShown ? 0 : enterDelay;
      const classes = tooltip.customClass
        .split(/\s+/)
        .filter((name) => name && name !== INSTANT_HINT_CLASS);
      if (group.hasShown) classes.push(INSTANT_HINT_CLASS);
      tooltip.customClass = classes.join(' ');
    };
    // Prepare before Koobiq's mouseenter listener creates the tooltip overlay.
    element.nativeElement.addEventListener('mouseenter', prepare, { capture: true });
    const visible = tooltip.visibleChange.subscribe((shown) => {
      if (shown) group.hasShown = true;
    });
    destroy.onDestroy(() => {
      element.nativeElement.removeEventListener('mouseenter', prepare, { capture: true });
      visible.unsubscribe();
    });
    // Dropdown items restart their focus monitor during the first render.
    afterNextRender(() => {
      const subscription = focusMonitor.monitor(element).subscribe((origin) => {
        if (origin === 'keyboard') {
          prepare();
          tooltip.show();
        } else tooltip.hide();
      });
      destroy.onDestroy(() => subscription.unsubscribe());
      if (
        element.nativeElement.ownerDocument.activeElement === element.nativeElement &&
        element.nativeElement.classList.contains('cdk-keyboard-focused')
      ) {
        prepare();
        tooltip.show();
      }
    });
  }
}
