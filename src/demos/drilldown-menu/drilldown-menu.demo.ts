import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqDividerModule } from '@koobiq/components/divider';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { KbqInputModule } from '@koobiq/components/input';
import { KbqToggleModule } from '@koobiq/components/toggle';
import {
  AutoRefreshMenu,
  AutoRefreshPeriod,
  AutoRefreshPreset,
} from './auto-refresh/auto-refresh-menu';
import { DrilldownMenu } from './menu/drilldown-menu';
import { DrilldownMenuList } from './menu/drilldown-menu-list';
import { DrilldownMenuScreen } from './menu/drilldown-menu-screen';
import { DrilldownMenuTrigger } from './menu/drilldown-menu-trigger';

@Component({
  selector: 'drilldown-menu-demo',
  imports: [
    FormsModule,
    KbqButtonModule,
    KbqDividerModule,
    KbqDropdownItem,
    KbqFormFieldModule,
    KbqIconModule,
    KbqToolTipModule,
    KbqInputModule,
    KbqToggleModule,
    DrilldownMenu,
    DrilldownMenuScreen,
    DrilldownMenuTrigger,
    DrilldownMenuList,
    AutoRefreshMenu,
  ],
  templateUrl: './drilldown-menu.demo.html',
  styleUrl: './drilldown-menu.demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrilldownMenuDemo {
  readonly period = signal<AutoRefreshPeriod>(300000);
  readonly maxHeight = signal(480);
  readonly longPresets = signal(false);
  readonly includeAutoRefresh = signal(true);
  readonly autoRefreshAfter = signal(false);
  readonly refreshCount = signal(0);
  readonly helpCount = signal(0);
  readonly presets = computed<readonly AutoRefreshPreset[]>(() =>
    this.longPresets()
      ? Array.from({ length: 40 }, (_, index) => ({
          value: (index + 1) * 60000,
          label: `${index + 1} мин`,
        }))
      : [
          { value: 15000, label: '15 с' },
          { value: 30000, label: '30 с' },
          { value: 60000, label: '1 мин' },
          { value: 300000, label: '5 мин' },
          { value: 600000, label: '10 мин' },
          { value: 1800000, label: '30 мин' },
        ],
  );
  readonly periodLabel = computed(() =>
    this.period() === null
      ? 'Отключено'
      : (this.presets().find((preset) => preset.value === this.period())?.label ??
        `${this.period()! / 1000} с`),
  );
  readonly leadingItems = [
    { label: 'Столбцы', icon: 'kbq-3-columns_16', caption: '21 из 34' },
    { label: 'Сортировка', icon: 'kbq-arrow-up-arrow-down_16', caption: 'event_src.host ↓' },
    { label: 'Группировка', icon: 'kbq-grid-group_16', caption: '' },
  ];
  readonly trailingItems = [
    { label: 'Столбцы по содержимому', icon: 'kbq-arrows-left-right-to-line_16' },
    { label: 'Свернуть группы', icon: 'kbq-chevrons-down-up_16' },
    { label: 'Развернуть группы', icon: 'kbq-chevrons-up-down_16' },
    { label: 'Полноэкранный режим', icon: 'kbq-arrows-expand-diagonal_16' },
  ];

  refresh(menu: DrilldownMenu): void {
    this.refreshCount.update((value) => value + 1);
    menu.close();
  }
}
