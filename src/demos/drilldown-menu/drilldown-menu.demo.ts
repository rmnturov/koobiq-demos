import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqDividerModule } from '@koobiq/components/divider';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { KbqInputModule } from '@koobiq/components/input';
import { KbqToggleModule } from '@koobiq/components/toggle';
import {
  DateAdapter,
  DateFormatter,
  KbqFormattersModule,
  KbqHighlightBackgroundPipe,
  KbqOptgroup,
  KbqPseudoCheckbox,
} from '@koobiq/components/core';
import {
  AutoRefreshMenu,
  AutoRefreshPeriod,
  AutoRefreshPreset,
} from './auto-refresh/auto-refresh-menu';
import { DrilldownMenu } from './menu/drilldown-menu';
import { DrilldownMenuList } from './menu/drilldown-menu-list';
import { DrilldownMenuScreen } from './menu/drilldown-menu-screen';
import { DrilldownMenuTrigger } from './menu/drilldown-menu-trigger';

const INCIDENT_FIELD_GROUPS = [
  {
    id: 'pinned-left',
    label: 'Закреплено слева',
    fields: [
      { id: 'incident-id', label: 'Идентификатор инцидента' },
      { id: 'incident-name', label: 'Название инцидента' },
    ],
  },
  {
    id: 'visible',
    label: 'Отображаются',
    fields: [
      { id: 'severity', label: 'Критичность' },
      { id: 'status', label: 'Состояние' },
      { id: 'category', label: 'Категория' },
      { id: 'detected-at', label: 'Дата обнаружения' },
      { id: 'registered-at', label: 'Дата регистрации' },
      { id: 'source-address', label: 'Адрес источника' },
      { id: 'destination-node', label: 'Узел назначения' },
    ],
  },
  {
    id: 'pinned-right',
    label: 'Закреплено справа',
    fields: [
      { id: 'assignee', label: 'Ответственный' },
      { id: 'response-time', label: 'Время реакции' },
    ],
  },
  {
    id: 'hidden',
    label: 'Не показаны',
    fields: [
      { id: 'closed-at', label: 'Дата закрытия' },
      { id: 'source-node', label: 'Узел источника' },
      { id: 'destination-address', label: 'Адрес назначения' },
      { id: 'detection-method', label: 'Способ обнаружения' },
      { id: 'affected-assets', label: 'Затронутые активы' },
      { id: 'closure-reason', label: 'Причина закрытия' },
      { id: 'description', label: 'Описание' },
    ],
  },
];

const DEFAULT_INCIDENT_FIELDS: ReadonlySet<string> = new Set(['incident-id', 'severity', 'status']);

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
    KbqHighlightBackgroundPipe,
    KbqIconModule,
    KbqOptgroup,
    KbqPseudoCheckbox,
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
  private readonly dateAdapter = inject(DateAdapter);
  private readonly dateFormatter = inject(DateFormatter);
  private readonly durationOrigin = this.dateAdapter.deserialize(new Date(Date.UTC(2001, 0, 1)))!;
  private durationEnd(value: number) {
    return this.dateAdapter.deserialize(new Date(this.durationOrigin.toMillis() + value))!;
  }
  readonly period = signal<AutoRefreshPeriod>(300000);
  readonly maxHeight = signal(480);
  readonly longPresets = signal(true);
  readonly includeAutoRefresh = signal(true);
  readonly autoRefreshAfter = signal(false);
  readonly refreshCount = signal(0);
  readonly helpCount = signal(0);
  protected readonly incidentQuery = signal('');
  protected readonly incidentSearchTerm = computed(() => this.incidentQuery().trim());
  protected readonly incidentGroups = computed(() => {
    const query = this.incidentSearchTerm().toLowerCase();
    return INCIDENT_FIELD_GROUPS.map((group) => ({
      ...group,
      fields: group.fields.filter((field) => field.label.toLowerCase().includes(query)),
    })).filter((group) => group.fields.length > 0);
  });
  private readonly visibleIncidentFields = computed(() =>
    this.incidentGroups().flatMap((group) => group.fields),
  );
  protected readonly selectedIncidentFields = signal(DEFAULT_INCIDENT_FIELDS);
  protected readonly activeIncidentField = signal<string | null>(null);
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

  protected setIncidentQuery(query: string): void {
    this.incidentQuery.set(query);
    this.activeIncidentField.set(null);
  }

  protected resetIncidentFields(): void {
    this.selectedIncidentFields.set(DEFAULT_INCIDENT_FIELDS);
    this.setIncidentQuery('');
  }

  protected selectIncidentField(fieldId: string, menu: DrilldownMenu): void {
    this.activeIncidentField.set(fieldId);
    this.toggleIncidentField(fieldId);
    const search = menu.screenElement()?.querySelector<HTMLInputElement>('[data-incident-search]');
    search?.focus({ preventScroll: true });
  }

  protected onIncidentSearchKeydown(event: KeyboardEvent, menu: DrilldownMenu): void {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const activeId = this.activeIncidentField();
    if (event.key === 'Enter' && activeId) {
      event.preventDefault();
      if (!event.repeat) this.toggleIncidentField(activeId);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const fields = this.visibleIncidentFields();
    if (!fields.length) return;
    event.preventDefault();
    const index = fields.findIndex((field) => field.id === activeId);
    let nextIndex = Math.min(index + 1, fields.length - 1);
    if (event.key === 'ArrowUp') {
      nextIndex = index < 0 ? fields.length - 1 : Math.max(index - 1, 0);
    }
    const next = fields[nextIndex];
    this.activeIncidentField.set(next.id);
    const option = document.getElementById(this.incidentOptionId(menu, next.id));
    if (option) menu.revealTarget(option);
  }

  protected incidentOptionId(menu: DrilldownMenu, fieldId: string): string {
    return `${menu.id}-incident-field-${fieldId}`;
  }

  private toggleIncidentField(fieldId: string): void {
    const selected = new Set(this.selectedIncidentFields());
    if (!selected.delete(fieldId)) selected.add(fieldId);
    this.selectedIncidentFields.set(selected);
  }
}
