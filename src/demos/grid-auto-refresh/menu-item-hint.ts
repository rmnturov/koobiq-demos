import { FocusMonitor } from '@angular/cdk/a11y';
import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { KbqTooltipTrigger } from '@koobiq/components/tooltip';

@Directive({ selector: '[kbq-dropdown-item][kbqTooltip]' })
export class MenuItemHint {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef);
    const tooltip = inject(KbqTooltipTrigger);
    const focusMonitor = inject(FocusMonitor);
    const destroy = inject(DestroyRef);
    // Dropdown items restart their focus monitor during the first render.
    afterNextRender(() => {
      const subscription = focusMonitor.monitor(element).subscribe((origin) => {
        if (origin === 'keyboard') tooltip.show();
        else tooltip.hide();
      });
      destroy.onDestroy(() => subscription.unsubscribe());
      if (
        element.nativeElement.ownerDocument.activeElement === element.nativeElement &&
        element.nativeElement.classList.contains('cdk-keyboard-focused')
      ) {
        tooltip.show();
      }
    });
  }
}
