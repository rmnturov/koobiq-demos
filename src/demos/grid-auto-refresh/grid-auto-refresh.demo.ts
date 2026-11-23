import { NgTemplateOutlet, DatePipe } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { KbqActionsPanel, KbqActionsPanelModule, KbqActionsPanelRef } from '@koobiq/components/actions-panel';
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
import { AllCommunityModule, BodyScrollEvent, ColDef, GridApi, GridReadyEvent, ModuleRegistry, RowSelectionOptions, SelectionChangedEvent } from 'ag-grid-community';
import { AutoRefreshController } from './auto-refresh-controller';
import { FILTER_TEMPLATES, filterFromQuery, queryFromFilter } from './incident-filters';
import { IncidentGridContext, IncidentSortHeader, IncidentTitleCell, IncidentSeverityCell } from './incident-grid-cells';
import { Incident, SEVERITY_LABELS, STATUS_LABELS } from './incident-model';
import { IncidentServer } from './incident-server';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
    selector: 'grid-auto-refresh-demo',
    imports: [NgTemplateOutlet, DatePipe, AgGridAngular, KbqAgGridThemeModule, KbqActionsPanelModule, KbqButtonModule, KbqContentPanelModule, KbqDropdownModule, KbqFilterBarModule, KbqIconModule, KbqOverflowItemsModule, KbqPopoverModule, KbqTopBarModule],
    providers: [KbqActionsPanel, DateFormatter],
    templateUrl: './grid-auto-refresh.demo.html', styleUrl: './grid-auto-refresh.demo.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GridAutoRefreshDemo {
    readonly server = new IncidentServer();
    readonly state = new AutoRefreshController(this.server);
    readonly context: IncidentGridContext = { controller: this.state };
    readonly savedFilters: KbqFilter[] = [];
    readonly filter = signal(filterFromQuery(this.state.query()));
    readonly templates = FILTER_TEMPLATES;
    readonly statusLabels = STATUS_LABELS;
    readonly severityLabels = SEVERITY_LABELS;
    readonly ready = signal(false);
    readonly feedback = signal('');
    readonly intervals = [0, 5000, 15000, 30000, 60000];
    readonly controls = ['interval', 'refresh', 'count', 'error', 'recover', 'scenario', 'state'];
    readonly actions = ['Назначить', 'Изменить статус', 'Критичность', 'Запустить сценарий', 'Объединить', 'Связать'];
    readonly selection: RowSelectionOptions<Incident> = { mode: 'multiRow', enableClickSelection: false };
    readonly localeText = { ariaRowSelect: 'Нажмите пробел, чтобы выбрать строку', ariaRowDeselect: 'Нажмите пробел, чтобы снять выбор', ariaHeaderSelection: 'Выбрать все загруженные строки', loadingOoo: 'Загрузка…', noRowsToShow: 'Инциденты не найдены' };
    readonly getRowId = ({ data }: { data: Incident }) => data.id;
    readonly defaults: ColDef<Incident> = { sortable: false, resizable: true, headerComponent: IncidentSortHeader, minWidth: 110 };
    readonly columns: ColDef<Incident>[] = [
        { field: 'createdAt', headerName: 'Время создания', width: 184, valueFormatter: ({ value }) => this.formatDate(value) },
        { field: 'id', headerName: 'ID', width: 128 },
        { field: 'name', headerName: 'Название', minWidth: 300, flex: 1, cellRenderer: IncidentTitleCell },
        { field: 'severity', headerName: 'Критичность', width: 144, cellRenderer: IncidentSeverityCell, valueFormatter: ({ data }) => data ? SEVERITY_LABELS[data.severity] : '', cellClassRules: { 'severity-critical': ({ data }) => data?.severity === 4, 'severity-high': ({ data }) => data?.severity === 3 } },
        { field: 'status', headerName: 'Статус', width: 138, valueFormatter: ({ data }) => data ? STATUS_LABELS[data.status] : '' },
        { field: 'source', headerName: 'Источник', width: 185 }
    ];
    private readonly grid = signal<GridApi<Incident> | null>(null);
    private readonly panelService = inject(KbqActionsPanel);
    private readonly list = viewChild<ElementRef<HTMLElement>>('list');
    private readonly panelTemplate = viewChild<TemplateRef<unknown>>('actionsPanel');
    private panelRef: KbqActionsPanelRef | null = null;
    private syncing = false;
    private appliedRevision = -1;
    private filterRequest = 0;
    private feedbackTimer?: ReturnType<typeof setTimeout>;

    constructor() {
        const destroy = inject(DestroyRef);
        afterNextRender(() => {
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
            api.forEachNode(node => node.setSelected(!!node.id && ids.has(node.id)));
            api.refreshHeader();
            if (revision !== this.appliedRevision) {
                this.appliedRevision = revision;
                api.ensureIndexVisible(0, 'top');
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
                    const ref = this.panelService.open(template, { overlayContainer: host, maxWidth: 'calc(100% - 32px)' });
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

    gridReady(event: GridReadyEvent<Incident>): void { this.grid.set(event.api); }
    selectionChanged(event: SelectionChangedEvent<Incident>): void {
        if (!this.syncing && event.source !== 'rowDataChanged' && event.source !== 'api') this.state.setSelection(event.api.getSelectedRows().map(row => row.id));
    }
    scrolled(event: BodyScrollEvent<Incident>): void {
        if (event.direction !== 'vertical' || this.syncing) return;
        if (event.top > 0) this.state.protect('Прокрутка списка');
        if (event.api.getLastDisplayedRowIndex() >= this.state.visibleRows().length - 8) this.state.loadMore();
    }
    async filterChanged(filter: KbqFilter | null): Promise<void> {
        if (!filter) return;
        const id = ++this.filterRequest;
        this.filter.set(filter);
        const query = queryFromFilter(filter, this.state.query().sort);
        if (JSON.stringify(query) === JSON.stringify(this.state.query())) return;
        await this.state.setQuery(query);
        if (id === this.filterRequest) this.filter.set(filterFromQuery(this.state.query()));
    }
    intervalLabel(ms: number): string { return ms ? `Каждые ${ms / 1000} с` : 'Выключено'; }
    scenario(kind: string): void {
        if (kind === 'observe') {
            this.state.setSelection([]);
            this.state.closeCard();
            void this.state.refresh();
        } else if (kind === 'select') this.state.setSelection(this.state.visibleRows().slice(0, 2).map(row => row.id));
        else if (this.state.visibleRows()[0]) this.state.openCard(this.state.visibleRows()[0]);
    }
    acknowledge(action: string): void {
        this.notify(`${action}: обработано ${this.state.selectedIds().length} инцидентов`);
    }
    notify(message: string): void {
        this.feedback.set(message);
        clearTimeout(this.feedbackTimer);
        this.feedbackTimer = setTimeout(() => this.feedback.set(''), 4000);
    }
    formatDate(value: number): string { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value); }
}
