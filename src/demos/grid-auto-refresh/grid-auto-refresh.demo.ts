import { NgTemplateOutlet } from '@angular/common';
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
import { KbqLuxonDateModule } from '@koobiq/angular-luxon-adapter/adapter';
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
import { KbqMarkdown } from '@koobiq/components/markdown';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqOverflowItemsModule } from '@koobiq/components/overflow-items';
import { KbqTopBarModule } from '@koobiq/components/top-bar';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  BodyScrollEvent,
  BodyScrollEndEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  RowSelectionOptions,
  SelectionColumnDef,
  SelectionChangedEvent,
  SortChangedEvent,
  RowClickedEvent,
  RowClassRules,
  PostSortRowsParams,
} from 'ag-grid-community';
import { AutoRefreshController } from './auto-refresh-controller';
import { FILTER_TEMPLATES, IncidentFilters, filterFromQuery } from './incident-filters';
import { IncidentGridContext, IncidentIdCell, IncidentSeverityCell } from './incident-grid-cells';
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
    KbqMarkdown,
    KbqLuxonDateModule,
    AgGridAngular,
    KbqAgGridThemeModule,
    KbqActionsPanelModule,
    KbqButtonModule,
    KbqContentPanelModule,
    KbqDropdownModule,
    KbqFilterBarModule,
    KbqIconModule,
    KbqOverflowItemsModule,
    KbqTopBarModule,
  ],
  providers: [KbqActionsPanel, DateFormatter],
  templateUrl: './grid-auto-refresh.demo.html',
  styleUrl: './grid-auto-refresh.demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridAutoRefreshDemo {
  readonly articlePlaceholder = `# Автообновление в гриде

## Подзаголовок

Приятно, граждане, наблюдать, как базовые сценарии поведения пользователей призывают нас к новым свершениям, которые, в свою очередь, должны быть смешаны с не уникальными данными до степени совершенной неузнаваемости, из-за чего возрастает их статус бесполезности.

## Подзаголовок

Приятно, граждане, наблюдать, как базовые сценарии поведения пользователей призывают нас к новым свершениям, которые, в свою очередь, должны быть смешаны с не уникальными данными до степени совершенной неузнаваемости, из-за чего возрастает их статус бесполезности.
`;

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
  readonly minPanelWidth = 400;
  readonly compactCard = computed(() => this.workspaceWidth() < this.minPanelWidth + 336);
  readonly panelWidth = computed(() =>
    this.compactCard()
      ? Math.max(this.minPanelWidth, this.workspaceWidth() - 16)
      : Math.min(480, this.workspaceWidth() - 336),
  );
  readonly panelMaxWidth = computed(() =>
    this.compactCard() ? this.panelWidth() : Math.min(680, this.workspaceWidth() - 336),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly feedback = signal('');
  readonly intervals = [0, 5000, 15000, 30000, 60000];
  readonly controls = ['refresh', 'interval', 'count', 'error', 'recover', 'scenario'];
  readonly cardActions = [
    { id: 'assign', label: 'Назначить', feedback: 'Назначение ответственного' },
    { id: 'status', label: 'Изменить статус', feedback: 'Изменение статуса' },
  ];
  readonly actions = [
    'Назначить',
    'Изменить статус',
    'Критичность',
    'Запустить сценарий',
    'Объединить',
    'Связать',
  ];
  readonly selectionColumn: SelectionColumnDef = {
    pinned: 'left',
    lockPinned: true,
    lockPosition: 'left',
    suppressMovable: true,
  };
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
  readonly rowClasses: RowClassRules<Incident> = {
    'incident-new-row': ({ data }) =>
      !!data &&
      Date.now() - (this.state.lastApplied() ?? 0) < 1000 &&
      this.state.newlyAppliedIds().includes(data.id),
  };
  readonly arrivalStyle = () => ({
    '--incident-arrival-progress': `${-Math.max(0, Date.now() - (this.state.lastApplied() ?? 0))}ms`,
  });
  private readonly appliedOrder = computed(
    () => new Map(this.state.snapshot().map((row, index) => [row.id, index])),
  );
  // Native headers request sorting; rows keep the applied server order until the query succeeds.
  readonly keepAppliedOrder = ({ nodes }: PostSortRowsParams<Incident>): void => {
    const order = this.appliedOrder();
    nodes.sort((a, b) => (order.get(a.id!) ?? 0) - (order.get(b.id!) ?? 0));
  };
  readonly getRowId = ({ data }: { data: Incident }) => data.id;
  readonly defaults: ColDef<Incident> = {
    sortable: true,
    sortingOrder: ['desc', 'asc'],
    resizable: true,
    minWidth: 110,
    suppressKeyboardEvent: ({ event, colDef, data }) => {
      if (
        event.key === 'Enter' &&
        colDef.field !== undefined &&
        data &&
        !(event.target instanceof Element && event.target.closest('a, button, input'))
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
      field: 'id',
      headerName: 'ID',
      width: 132,
      cellRenderer: IncidentIdCell,
      pinned: 'left',
      lockPinned: true,
      lockPosition: 'left',
      suppressMovable: true,
    },
    { field: 'name', headerName: 'Название', minWidth: 280, flex: 1 },
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
    {
      field: 'createdAt',
      headerName: 'Время создания',
      width: 200,
      sort: 'desc',
      valueFormatter: ({ value }) => this.formatDate(value),
    },
  ];
  private readonly grid = signal<GridApi<Incident> | null>(null);
  private readonly injector = inject(Injector);
  private readonly panelService = inject(KbqActionsPanel);
  private readonly gridArea = viewChild<ElementRef<HTMLElement>>('gridArea');
  private readonly dateFormatter = inject<DateFormatter<unknown>>(DateFormatter);
  private returningToTop = false;
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
      if (revision !== this.appliedRevision) {
        this.returningToTop =
          (this.gridArea()?.nativeElement.querySelector('.ag-body-viewport')?.scrollTop ?? 0) > 0;
      }
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
        const viewport =
          this.gridArea()?.nativeElement.querySelector<HTMLElement>('.ag-body-viewport');
        if (this.returningToTop && viewport) {
          afterNextRender(() => this.scrollToBeginning(viewport), { injector: this.injector });
        } else if (rows.length) api.ensureIndexVisible(0, 'top');
      }
      this.syncing = false;
    });
    effect(() => {
      const selected = this.state.selectedIds().length;
      if (!this.ready()) return;
      if (selected && !this.panelRef) {
        const template = this.panelTemplate();
        const host = this.gridArea();
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
  sortChanged(event: SortChangedEvent<Incident>): void {
    if (this.syncing) return;
    const next = event.api.getColumnState().find((column) => column.sort);
    if (!next?.sort) return;
    const applied = this.state.query();
    if (next.colId === applied.sort.field && next.sort === applied.sort.direction) return;
    this.syncing = true;
    event.api.applyColumnState({
      state: [{ colId: applied.sort.field, sort: applied.sort.direction }],
      defaultState: { sort: null },
    });
    this.syncing = false;
    void this.state.setQuery({
      ...applied,
      sort: { field: next.colId as IncidentSortField, direction: next.sort },
    });
  }
  rowClicked(event: RowClickedEvent<Incident>): void {
    const target = event.event?.target;
    if (target instanceof Element && target.closest('a, button, input, .ag-selection-checkbox'))
      return;
    if (event.data) this.state.openCard(event.data);
  }
  private scrollToBeginning(viewport: HTMLElement): void {
    if (!this.returningToTop) return;
    if (viewport.scrollTop <= 1) {
      this.cancelReturnScroll();
      return;
    }
    // CSS scroll-behavior breaks AG Grid's synchronous ensureIndexVisible loop; animate only this return.
    viewport.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
  scrollEnded(event: BodyScrollEndEvent): void {
    if (event.direction === 'vertical') this.cancelReturnScroll();
  }
  cancelReturnScroll(): void {
    this.returningToTop = false;
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
    if (this.returningToTop && event.direction === 'vertical') {
      if (event.top <= 1) this.cancelReturnScroll();
      return;
    }
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
  formatDate(value: number | null): string {
    return value === null
      ? 'ещё не выполнялась'
      : this.dateFormatter.absoluteShortDateTime(this.dateFormatter.adapter.parse(value, null), {
          seconds: true,
        });
  }
}
