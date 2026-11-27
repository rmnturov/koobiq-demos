import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
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
import { KbqDividerModule } from '@koobiq/components/divider';
import {
  KbqFilter,
  KbqFilterBarModule,
  KbqPipeTemplate,
  KbqPipeTypes,
} from '@koobiq/components/filter-bar';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqLinkModule } from '@koobiq/components/link';
import { KbqTopBarModule } from '@koobiq/components/top-bar';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellClickedEvent,
  CellKeyDownEvent,
  ColDef,
  FirstDataRenderedEvent,
  FullWidthCellKeyDownEvent,
  GetRowIdParams,
  ICellRendererParams,
  RowClassRules,
  RowSelectionOptions,
} from 'ag-grid-community';
import { INCIDENT_ARTICLES, IncidentArticle } from './incident-articles';

@Component({
  selector: 'incident-article-link',
  imports: [KbqLinkModule],
  template: `<a kbqLink pseudo underline="always" [tabIndex]="-1">{{ name }}</a>`,
})
class IncidentArticleLink implements ICellRendererAngularComp {
  name = '';
  agInit(params: ICellRendererParams<IncidentArticle, string>) {
    this.name = params.value ?? '';
  }
  refresh(params: ICellRendererParams<IncidentArticle, string>) {
    this.agInit(params);
    return true;
  }
}

@Component({
  selector: 'app-article-grid',
  imports: [
    AgGridAngular,
    KbqAgGridThemeModule,
    KbqActionsPanelModule,
    KbqButtonModule,
    KbqContentPanelModule,
    KbqDividerModule,
    KbqFilterBarModule,
    KbqIconModule,
    KbqTopBarModule,
    NgTemplateOutlet,
  ],
  providers: [KbqActionsPanel],
  templateUrl: './article-grid.component.html',
  styleUrl: './article-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleGridComponent {
  readonly articleTemplate = input.required<TemplateRef<{ $implicit: string }>>();
  private readonly records = signal(INCIDENT_ARTICLES);
  protected readonly filter = signal<KbqFilter>({
    name: '',
    readonly: false,
    disabled: false,
    changed: false,
    saved: false,
    pipes: [
      {
        id: 'status',
        name: 'Статус',
        type: KbqPipeTypes.Select,
        value: null,
        cleanable: true,
        removable: false,
        disabled: false,
      },
    ],
  });
  protected readonly filterTemplates: KbqPipeTemplate[] = [
    {
      id: 'status',
      name: 'Статус',
      type: KbqPipeTypes.Select,
      values: ['Новый', 'В работе', 'Закрыт'].map((name) => ({ name, id: name, value: name })),
      cleanable: true,
      removable: false,
      disabled: false,
    },
    {
      id: 'search',
      name: 'Название',
      type: KbqPipeTypes.Input,
      cleanable: true,
      removable: true,
      disabled: false,
    },
  ];
  protected readonly rows = computed(() => {
    const pipes = this.filter().pipes;
    const status = pipes.find((pipe) => pipe.id === 'status')?.value as { value: string } | null;
    const search = String(pipes.find((pipe) => pipe.id === 'search')?.value ?? '')
      .trim()
      .toLowerCase();
    return this.records().filter(
      (row) => (!status || row.status === status.value) && row.name.toLowerCase().includes(search),
    );
  });
  protected readonly modules = [AllCommunityModule];
  protected readonly columns: ColDef<IncidentArticle>[] = [
    {
      field: 'name',
      headerName: 'Название',
      flex: 2,
      minWidth: 195,
      cellRenderer: IncidentArticleLink,
    },
    { field: 'status', headerName: 'Статус', flex: 1, minWidth: 94 },
    { field: 'service', headerName: 'Сервис', flex: 1, minWidth: 150 },
    { field: 'owner', headerName: 'Ответственный', flex: 1, minWidth: 135 },
    { field: 'updated', headerName: 'Обновлён', width: 100 },
  ];
  protected readonly selection: RowSelectionOptions<IncidentArticle> = {
    mode: 'multiRow',
    enableClickSelection: false,
    selectAll: 'filtered',
  };
  protected readonly getRowId = ({ data }: GetRowIdParams<IncidentArticle>) => data.id;
  protected readonly activeId = signal<string | null>(INCIDENT_ARTICLES[0].id);
  protected readonly active = computed(() => this.rows().find((row) => row.id === this.activeId()));
  protected readonly markdown = computed(() => {
    const record = this.active();
    return record ? `# ${record.name}\n\n${record.body}` : '';
  });
  protected readonly rowClasses: RowClassRules<IncidentArticle> = {
    'article-open': ({ data }) => !!data && data.id === this.activeId(),
  };
  protected readonly count = signal(0);
  protected readonly grid = viewChild.required<AgGridAngular<IncidentArticle>>(AgGridAngular);
  private readonly area = viewChild.required<ElementRef<HTMLElement>>('gridArea');
  private readonly actions = viewChild.required<TemplateRef<unknown>>('actions');
  private readonly panels = inject(KbqActionsPanel);
  private actionRef?: KbqActionsPanelRef;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dismissActions());
    effect(() => {
      if (!this.count()) {
        this.dismissActions();
        return;
      }
      if (this.actionRef) return;
      const ref = this.panels.open(this.actions(), {
        overlayContainer: this.area(),
        maxWidth: 'calc(100% - 16px)',
      });
      this.actionRef = ref;
      ref.beforeClosed.subscribe(() => {
        if (this.actionRef !== ref) return;
        this.actionRef = undefined;
        this.grid().api.deselectAll();
      });
    });
  }
  private dismissActions() {
    const ref = this.actionRef;
    this.actionRef = undefined;
    ref?.close();
  }
  protected selectFirst({ api }: FirstDataRenderedEvent<IncidentArticle>) {
    api.getDisplayedRowAtIndex(0)?.setSelected(true);
  }
  protected applyFilter(filter: KbqFilter | null) {
    if (!filter) return;
    this.filter.set(filter);
    if (!this.active()) this.activeId.set(null);
  }
  private showArticle(id: string | null) {
    const previous = this.activeId();
    if (previous === id) return;
    this.activeId.set(id);
    const api = this.grid().api;
    for (const key of [previous, id]) {
      const node = key && api.getRowNode(key);
      if (node && node.data) node.updateData(node.data);
    }
  }
  protected onCellClick({ column, data }: CellClickedEvent<IncidentArticle>) {
    if (data && column.getColDef().field) this.showArticle(data.id);
  }
  protected onCellKeyDown(
    cell: CellKeyDownEvent<IncidentArticle> | FullWidthCellKeyDownEvent<IncidentArticle>,
  ) {
    if (
      'column' in cell &&
      cell.event instanceof KeyboardEvent &&
      cell.event.key === 'Enter' &&
      cell.data &&
      cell.column.getColDef().field
    ) {
      this.showArticle(cell.data.id);
    }
  }
  protected closeArticle() {
    const id = this.activeId();
    if (!id) return;
    this.showArticle(null);
    const api = this.grid().api;
    const rowIndex = api.getRowNode(id)?.rowIndex;
    if (rowIndex != null) api.setFocusedCell(rowIndex, 'name');
  }
  protected changeStatus(status: string) {
    const ids = new Set(
      this.grid()
        .api.getSelectedRows()
        .map((row) => row.id),
    );
    this.records.update((records) =>
      records.map((row) => (ids.has(row.id) ? { ...row, status } : row)),
    );
    if (!this.active()) this.activeId.set(null);
  }
}
