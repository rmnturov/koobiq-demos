import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqDividerModule } from '@koobiq/components/divider';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { KbqInputModule } from '@koobiq/components/input';
import { KbqSkeletonTable } from '@koobiq/components/skeleton';
import { KbqToggleModule } from '@koobiq/components/toggle';
import { DateAdapter, DateFormatter, KbqFormattersModule } from '@koobiq/components/core';
import {
  AutoRefreshMenu,
  AutoRefreshPeriod,
  AutoRefreshPreset,
} from './auto-refresh/auto-refresh-menu';
import { IncidentFieldsMenu } from './incident-fields/incident-fields-menu';
import { DrilldownMenu } from './menu/drilldown-menu';
import { DrilldownMenuList } from './menu/drilldown-menu-list';
import { DrilldownMenuScreen } from './menu/drilldown-menu-screen';
import { DrilldownMenuTrigger } from './menu/drilldown-menu-trigger';

const DENSITY_OPTIONS = ['Низкая', 'Средняя', 'Высокая'] as const;
const DEFAULT_DENSITY = DENSITY_OPTIONS[1];

@Component({
  selector: 'drilldown-menu-demo',
  imports: [
    FormsModule,
    KbqLuxonDateModule,
    KbqFormattersModule,
    KbqButtonModule,
    KbqDividerModule,
    KbqDropdownItem,
    KbqFormFieldModule,
    KbqIconModule,
    KbqToolTipModule,
    KbqInputModule,
    KbqSkeletonTable,
    KbqToggleModule,
    DrilldownMenu,
    DrilldownMenuScreen,
    DrilldownMenuTrigger,
    DrilldownMenuList,
    AutoRefreshMenu,
    IncidentFieldsMenu,
  ],
  templateUrl: './drilldown-menu.demo.html',
  styleUrl: './drilldown-menu.demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrilldownMenuDemo {
  private readonly dateAdapter = inject(DateAdapter);
  private readonly dateFormatter = inject(DateFormatter);
  private readonly injector = inject(Injector);
  private readonly durationOrigin = this.dateAdapter.deserialize(new Date(Date.UTC(2001, 0, 1)))!;
  private durationEnd(value: number) {
    return this.dateAdapter.deserialize(new Date(this.durationOrigin.toMillis() + value))!;
  }
  readonly period = signal<AutoRefreshPeriod>(300000);
  readonly maxHeight = signal<number | null>(480);
  readonly longPresets = signal(true);
  readonly includeAutoRefresh = signal(true);
  readonly autoRefreshAfter = signal(false);
  readonly refreshCount = signal(0);
  readonly helpCount = signal(0);
  protected readonly densityOptions = DENSITY_OPTIONS;
  protected readonly density = signal<(typeof DENSITY_OPTIONS)[number]>(DEFAULT_DENSITY);
  protected readonly defaultIncidentFields = ['incident-id', 'severity', 'status'];
  protected readonly defaultSortFields = ['source-node'];
  protected readonly columnFieldIds = signal<ReadonlySet<string>>(new Set(this.defaultIncidentFields));
  protected readonly sortFieldIds = signal<ReadonlySet<string>>(new Set(this.defaultSortFields));
  protected readonly groupFieldIds = signal<ReadonlySet<string>>(new Set());
  protected readonly testFieldIds = signal<ReadonlySet<string>>(new Set(this.defaultIncidentFields));
  readonly formatPeriod = (value: number): string =>
    this.dateFormatter.durationLong(this.durationOrigin, this.durationEnd(value));
  readonly formatShortPeriod = (value: number): string =>
    this.dateFormatter.durationShort(this.durationOrigin, this.durationEnd(value));
  private readonly longPresetValues = [
    5000,
    10000,
    15000,
    30000,
    45000,
    ...Array.from({ length: 59 }, (_, index) => (index + 1) * 60000),
    ...Array.from({ length: 23 }, (_, index) => (index + 1) * 3600000),
    ...Array.from({ length: 30 }, (_, index) => (index + 1) * 86400000),
  ];
  readonly presets = computed<readonly AutoRefreshPreset[]>(() =>
    this.longPresets()
      ? this.longPresetValues.map((value) => ({ value, label: this.formatPeriod(value) }))
      : [
          15000, 30000, 60000, 300000, 600000, 1800000,
        ].map((value) => ({ value, label: this.formatPeriod(value) })),
  );
  readonly periodLabel = computed(() =>
    this.period() === null
      ? 'Отключено'
      : (this.presets().find((preset) => preset.value === this.period())?.label ??
        this.formatPeriod(this.period()!)),
  );
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

  protected resetDensity(menu: DrilldownMenu): void {
    this.density.set(DEFAULT_DENSITY);
    afterNextRender(() => menu.scrollInitialFocusTarget('density', 'smooth'), {
      injector: this.injector,
    });
  }
}
