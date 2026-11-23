import { NgTemplateOutlet, DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  computed,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import {
  KbqActionsPanel,
  KbqActionsPanelModule,
  KbqActionsPanelRef,
} from '@koobiq/components/actions-panel';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqContentPanelModule } from '@koobiq/components/content-panel';
import { DateFormatter } from '@koobiq/components/core';
import { KbqDropdownModule } from '@koobiq/components/dropdown';
import { KbqFilter, KbqFilterBarModule } from '@koobiq/components/filter-bar';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqOverflowItemsModule } from '@koobiq/components/overflow-items';
import { KbqPopoverModule } from '@koobiq/components/popover';
import { KbqTopBarModule } from '@koobiq/components/top-bar';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  BodyScrollEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  RowSelectionOptions,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AutoRefreshController } from './auto-refresh-controller';
import { FILTER_TEMPLATES, IncidentFilters, filterFromQuery } from './incident-filters';
import {
  IncidentGridContext,
  IncidentSortHeader,
  IncidentTitleCell,
  IncidentSeverityCell,
} from './incident-grid-cells';
import {
  DEFAULT_QUERY,
  Incident,
  IncidentSortField,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from './incident-model';
import { IncidentServer } from './incident-server';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'grid-auto-refresh-demo',
  imports: [
    NgTemplateOutlet,
    DatePipe,
    AgGridAngular,
    KbqAgGridThemeModule,
    KbqActionsPanelModule,
    KbqButtonModule,
    KbqContentPanelModule,
    KbqDropdownModule,
    KbqFilterBarModule,
    KbqIconModule,
    KbqOverflowItemsModule,
    KbqPopoverModule,
    KbqTopBarModule,
  ],
  providers: [KbqActionsPanel, DateFormatter],
  templateUrl: './grid-auto-refresh.demo.html',
  styleUrl: './grid-auto-refresh.demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridAutoRefreshDemo {
  readonly server = new IncidentServer();
  readonly state = new AutoRefreshController(this.server);
  readonly context: IncidentGridContext = { controller: this.state };
  readonly savedFilters: KbqFilter[] = [
    { ...filterFromQuery(DEFAULT_QUERY), name: 'Все инциденты', readonly: true, saved: true },
    {
      ...filterFromQuery({ ...DEFAULT_QUERY, status: 'new', severity: 4 }),
      name: 'Новые критические',
      readonly: true,
      saved: true,
    },
  ];
  readonly incidentFilters = new IncidentFilters(this.state);
  readonly filter = this.incidentFilters.filter;
  readonly templates = FILTER_TEMPLATES;
  readonly statusLabels = STATUS_LABELS;
  readonly severityLabels = SEVERITY_LABELS;
  readonly ready = signal(false);
  readonly workspaceWidth = signal(window.innerWidth);
  readonly compactCard = computed(() => this.workspaceWidth() < 600);
  readonly panelWidth = computed(() =>
    this.compactCard()
      ? Math.max(160, this.workspaceWidth() - 16)
      : Math.min(480, this.workspaceWidth() - 336),
  );
  readonly panelMaxWidth = computed(() =>
    this.compactCard() ? this.panelWidth() : Math.min(680, this.workspaceWidth() - 336),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly feedback = signal('');
  readonly intervals = [0, 5000, 15000, 30000, 60000];
  readonly controls = ['interval', 'refresh', 'count', 'error', 'recover', 'scenario', 'state'];
  readonly actions = [
    'Назначить',
    'Изменить статус',
    'Критичность',
    'Запустить сценарий',
    'Объединить',
    'Связать',
  ];
  readonly selection: RowSelectionOptions<Incident> = {
    mode: 'multiRow',
    enableClickSelection: false,
  };
  readonly localeText = {
    ariaRowSelect: 'Нажмите пробел, чтобы выбрать строку',
    ariaRowDeselect: 'Нажмите пробел, чтобы снять выбор',
    ariaHeaderSelection: 'Выбрать все загруженные строки',
    loadingOoo: 'Загрузка…',
    noRowsToShow: 'Инциденты не найдены',
  };
  readonly getRowId = ({ data }: { data: Incident }) => data.id;
  readonly defaults: ColDef<Incident> = {
    sortable: false,
    resizable: true,
    headerComponent: IncidentSortHeader,
    minWidth: 110,
    suppressHeaderKeyboardEvent: ({ event, column }) => {
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        'getColId' in column &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        this.sortField(column.getColId() as IncidentSortField);
        return true;
      }
      return false;
    },
    suppressKeyboardEvent: ({ event, colDef, data }) => {
      if (
        event.key === 'Enter' &&
        colDef.field === 'name' &&
        data &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        this.state.openCard(data);
        return true;
      }
      return false;
    },
  };
  readonly columns: ColDef<Incident>[] = [
    {
      field: 'createdAt',
      headerName: 'Время создания',
      width: 184,
      valueFormatter: ({ value }) => this.formatDate(value),
    },
    { field: 'id', headerName: 'ID', width: 128 },
    {
      field: 'name',
      headerName: 'Название',
      minWidth: 300,
      flex: 1,
      cellRenderer: IncidentTitleCell,
    },
    {
      field: 'severity',
      headerName: 'Критичность',
      width: 144,
      cellRenderer: IncidentSeverityCell,
      valueFormatter: ({ data }) => (data ? SEVERITY_LABELS[data.severity] : ''),
      cellClassRules: {
        'severity-critical': ({ data }) => data?.severity === 4,
        'severity-high': ({ data }) => data?.severity === 3,
      },
    },
    {
      field: 'status',
      headerName: 'Статус',
      width: 138,
      valueFormatter: ({ data }) => (data ? STATUS_LABELS[data.status] : ''),
    },
    { field: 'source', headerName: 'Источник', width: 185 },
  ];
  private readonly grid = signal<GridApi<Incident> | null>(null);
  private readonly injector = inject(Injector);
  private readonly panelService = inject(KbqActionsPanel);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly panelTemplate = viewChild<TemplateRef<unknown>>('actionsPanel');
  private panelRef: KbqActionsPanelRef | null = null;
  private syncing = false;
  private appliedRevision = -1;
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const resize = new ResizeObserver(([entry]) =>
        this.workspaceWidth.set(entry.contentRect.width),
      );
      resize.observe(this.host.nativeElement);
      destroy.onDestroy(() => resize.disconnect());
      this.ready.set(true);
      this.state.start();
      void this.state.setVisibility(document.hidden);
    });
    const visibility = () => void this.state.setVisibility(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    destroy.onDestroy(() => {
      this.state.destroy();
      document.removeEventListener('visibilitychange', visibility);
      clearTimeout(this.feedbackTimer);
      this.panelRef?.close();
    });
    effect(() => {
      const api = this.grid();
      const rows = this.state.visibleRows();
      const ids = new Set(this.state.selectedIds());
      const revision = this.state.revision();
      if (!api || api.isDestroyed()) return;
      this.syncing = true;
      api.setGridOption('rowData', [...rows]);
      api.forEachNode((node) => node.setSelected(!!node.id && ids.has(node.id)));
      const sort = this.state.query().sort;
      api.applyColumnState({
        state: [{ colId: sort.field, sort: sort.direction }],
        defaultState: { sort: null },
      });
      api.refreshHeader();
      if (revision !== this.appliedRevision) {
        this.appliedRevision = revision;
        if (rows.length) api.ensureIndexVisible(0, 'top');
      }
      this.syncing = false;
    });
    effect(() => {
      const selected = this.state.selectedIds().length;
      if (!this.ready()) return;
      if (selected && !this.panelRef) {
        const template = this.panelTemplate();
        const host = this.list();
        if (template && host) {
          const ref = this.panelService.open(template, {
            overlayContainer: host,
            maxWidth: 'calc(100% - 32px)',
          });
          this.panelRef = ref;
          ref.beforeClosed.subscribe(() => {
            if (this.panelRef === ref) {
              this.panelRef = null;
              if (this.state.selectedIds().length) this.state.setSelection([]);
            }
          });
        }
      } else if (!selected && this.panelRef) {
        const ref = this.panelRef;
        this.panelRef = null;
        ref.close();
      }
    });
  }

  async showNewRecords(): Promise<void> {
    const button = document.activeElement;
    if (!(await this.state.refresh())) return;
    afterNextRender(
      () => {
        if (
          button?.isConnected ||
          (document.activeElement && document.activeElement !== document.body)
        )
          return;
        const buttons = this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
          '[data-control="refresh"], .topbar button[kbqOverflowItemsResult]',
        );
        [...buttons].find((candidate) => candidate.getClientRects().length > 0)?.focus();
      },
      { injector: this.injector },
    );
  }
  sortField(field: IncidentSortField): void {
    const query = this.state.query();
    void this.state.setQuery({
      ...query,
      sort: {
        field,
        direction: query.sort.field === field && query.sort.direction === 'desc' ? 'asc' : 'desc',
      },
    });
  }
  gridReady(event: GridReadyEvent<Incident>): void {
    this.grid.set(event.api);
  }
  selectionChanged(event: SelectionChangedEvent<Incident>): void {
    if (!this.syncing && event.source !== 'rowDataChanged' && event.source !== 'api')
      this.state.setSelection(event.api.getSelectedRows().map((row) => row.id));
  }
  scrolled(event: BodyScrollEvent<Incident>): void {
    if (this.syncing) return;
    if (event.direction === 'horizontal') {
      if (event.left > 0) this.state.protect('Прокрутка списка');
      return;
    }
    if (event.top > 0) this.state.protect('Прокрутка списка');
    if (event.api.getLastDisplayedRowIndex() >= this.state.visibleRows().length - 8)
      this.state.loadMore();
  }
  filterChanged(filter: KbqFilter | null): Promise<void> {
    return this.incidentFilters.change(filter);
  }
  intervalLabel(ms: number): string {
    return ms ? `Каждые ${ms / 1000} с` : 'Выключено';
  }
  scenario(kind: string): void {
    if (kind === 'observe') {
      this.state.setSelection([]);
      this.state.closeCard();
      void this.state.refresh();
    } else if (kind === 'select')
      this.state.setSelection(
        this.state
          .visibleRows()
          .slice(0, 2)
          .map((row) => row.id),
      );
    else if (this.state.visibleRows()[0]) this.state.openCard(this.state.visibleRows()[0]);
  }
  acknowledge(action: string): void {
    this.notify(`${action} · Выбрано: ${this.state.selectedIds().length}`);
  }
  notify(message: string): void {
    this.feedback.set(message);
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.feedback.set(''), 4000);
  }
  formatDate(value: number): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(value);
  }
}
