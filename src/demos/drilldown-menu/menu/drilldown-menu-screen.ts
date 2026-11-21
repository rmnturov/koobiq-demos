import { DestroyRef, Directive, effect, inject, input, TemplateRef } from '@angular/core';
import { DRILLDOWN_MENU } from './drilldown-menu.types';

@Directive({ selector: 'ng-template[drilldownMenuScreen]' })
export class DrilldownMenuScreen {
  readonly id = input.required<string>({ alias: 'drilldownMenuScreen' });
  readonly title = input.required<string>();
  readonly screenWidth = input<number>();
  readonly initialFocus = input<string>();
  readonly headerActions = input<TemplateRef<unknown>>();
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);

  constructor() {
    const menu = inject(DRILLDOWN_MENU);
    effect((onCleanup) => {
      const id = this.id();
      menu.registerScreen(id, this);
      onCleanup(() => menu.unregisterScreen(id, this));
    });
    inject(DestroyRef);
  }
}
