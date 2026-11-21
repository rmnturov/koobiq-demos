import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { DrilldownMenuList } from '../menu/drilldown-menu-list';
import { DrilldownMenuScreen } from '../menu/drilldown-menu-screen';
import { DRILLDOWN_MENU } from '../menu/drilldown-menu.types';

export type AutoRefreshPeriod = number | null;
export interface AutoRefreshPreset {
  value: number;
  label: string;
}

@Component({
  selector: 'demo-auto-refresh-menu',
  imports: [
    KbqDropdownItem,
    KbqIconModule,
    KbqToolTipModule,
    KbqButtonModule,
    DrilldownMenuScreen,
    DrilldownMenuList,
  ],
  templateUrl: './auto-refresh-menu.html',
  styleUrl: './auto-refresh-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoRefreshMenu {
  readonly menu = inject(DRILLDOWN_MENU);
  readonly presets = input<readonly AutoRefreshPreset[]>([]);
  readonly defaultValue = input<AutoRefreshPeriod>();
  readonly screenId = input('auto-refresh');
  readonly formatPeriod = input<(value: number) => string>();
  readonly value = model<AutoRefreshPeriod>(null);
  readonly prefix = computed(() => `${this.menu.id}-${this.screenId()}`);
  readonly options = computed(() => {
    const unique = new Map<number, AutoRefreshPreset>();
    for (const preset of this.presets()) {
      if (Number.isFinite(preset.value) && preset.value > 0 && !unique.has(preset.value))
        unique.set(preset.value, preset);
    }
    return [...unique.values()].sort((a, b) => a.value - b.value);
  });
  readonly caption = computed(() => {
    const value = this.value();
    if (value === null) return '';
    return (
      this.options().find((option) => option.value === value)?.label ??
      this.formatPeriod()?.(value) ??
      this.format(value)
    );
  });
  private readonly rootItem = viewChild.required('rootItem', { read: KbqDropdownItem });

  constructor() {
    const parentList = inject(DrilldownMenuList, { optional: true, skipSelf: true });
    effect((onCleanup) => {
      const item = this.rootItem();
      if (parentList) onCleanup(parentList.registerItem(item));
    });
  }

  select(value: AutoRefreshPeriod): void {
    this.value.set(value);
    this.menu.back();
  }

  reset(): void {
    const value = this.defaultValue();
    if (value !== undefined) this.value.set(value);
  }

  private format(value: number): string {
    if (value % 3600000 === 0) return `${value / 3600000} ч`;
    if (value % 60000 === 0) return `${value / 60000} мин`;
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(value / 1000)} с`;
  }
}
