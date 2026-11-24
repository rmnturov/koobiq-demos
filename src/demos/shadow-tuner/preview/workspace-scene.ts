import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { KbqBadgeModule } from '@koobiq/components/badge';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';
import { KbqContentPanelModule } from '@koobiq/components/content-panel';
import { KbqDropdownModule } from '@koobiq/components/dropdown';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqInputModule } from '@koobiq/components/input';
import { KbqLinkModule } from '@koobiq/components/link';
import { KbqNativeScrollbar } from '@koobiq/components/scrollbar';
import { KbqTopBarModule } from '@koobiq/components/top-bar';
import { AgGridAngular } from 'ag-grid-angular';
import {
    AllCommunityModule,
    CellClickedEvent,
    CellKeyDownEvent,
    ColDef,
    FirstDataRenderedEvent,
    FullWidthCellKeyDownEvent,
    ModuleRegistry,
    RowClassRules,
    RowSelectionOptions,
    SelectionChangedEvent,
    SelectionColumnDef,
    SELECTION_COLUMN_ID
} from 'ag-grid-community';

import { ShadowStore } from '../model/shadow-store';

ModuleRegistry.registerModules([AllCommunityModule]);

interface GridRow {
    id: number;
    name: string;
    scope: string;
    rule: string;
    category: string;
    status: string;
    source: string;
    owner: string;
    schedule: string;
    updatedAt: string;
    description: string;
    nextStep: string;
    channel: string;
}

const RULES = [
    {
        name: 'Объем общего трафика для клиента или сервера превышен',
        code: 'traffic_volume_threshold',
        category: 'Сетевой трафик',
        source: 'NetFlow',
        description: 'Суммарный объём трафика превысил порог за час',
        nextStep: 'Сверить объём трафика с обычной нагрузкой'
    },
    {
        name: 'Количество активных сессий на сервере превышает лимит',
        code: 'session_limit_warning',
        category: 'Подключения',
        source: 'Журнал сервера',
        description: 'Сервер открыл больше сессий, чем допускает профиль',
        nextStep: 'Проверить список активных сессий'
    },
    {
        name: 'Проблемы при входе пользователя',
        code: 'private_user_detection',
        category: 'Аутентификация',
        source: 'Журнал входов',
        description: 'Зафиксировано несколько неудачных попыток входа',
        nextStep: 'Проверить, с какого узла выполнялся вход'
    },
    {
        name: 'Диск на сервере заполнен',
        code: 'disk_usage_threshold',
        category: 'Хранилище',
        source: 'Агент мониторинга',
        description: 'Свободное место на диске опустилось ниже порога',
        nextStep: 'Найти каталоги, которые занимают больше всего места'
    }
];

const OWNERS = ['Алексей Петров', 'Мария Иванова', 'Команда мониторинга'];
const RULE_STATUSES = ['Активно', 'На проверке', 'Приостановлено'];
const SCHEDULES = ['Каждые 5 минут', 'Каждые 15 минут', 'Каждый час'];
const CHANNELS = ['Журнал событий', 'Почта команды', 'Очередь инцидентов'];

@Component({
    selector: 'app-workspace-scene',
    imports: [
        AgGridAngular,
        KbqAgGridThemeModule,
        KbqBadgeModule,
        KbqButtonModule,
        KbqButtonToggleModule,
        KbqContentPanelModule,
        KbqDropdownModule,
        KbqFormFieldModule,
        KbqIconModule,
        KbqInputModule,
        KbqLinkModule,
        KbqNativeScrollbar,
        KbqTopBarModule
    ],
    templateUrl: './workspace-scene.html',
    styleUrl: './workspace-scene.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceScene {
    protected readonly store = inject(ShadowStore);
    protected readonly opened = signal(true);
    protected readonly filterMenuOpen = signal(true);
    protected readonly panelMenuOpen = signal(true);
    protected readonly popoverOpen = signal(true);
    protected readonly descriptionExpanded = signal(false);
    protected readonly selectedCount = signal(2);
    protected readonly search = signal('');
    protected readonly selectedRow = signal<GridRow | null>(null);

    protected readonly panelShadow = computed(() => {
        const level = this.store.panel();

        return this.store.locked() || level === 'none' ? null : `var(--kbq-shadow-${level})`;
    });

    protected readonly filterActions = [
        { text: 'Сохранить изменения', icon: 'kbq-floppy-disk_16' },
        { text: 'Сохранить как новый', icon: 'kbq-plus_16' },
        { text: 'Переименовать', icon: 'kbq-pencil_16' },
        { text: 'Сбросить изменения', icon: 'kbq-circle-xmark_16', divider: true },
        { text: 'Удалить', icon: 'kbq-trash_16' }
    ];
    protected readonly panelMenuLabels = ['С', 'Текст', 'Текст', 'Текст', 'Текст', 'Текст'];
    protected readonly toggle = (open: boolean): boolean => !open;
    protected readonly tags = ['Phishing', 'Malware', 'Email', 'Trojan', 'C2', 'IOC', 'EDR', 'High', 'Active'];

    protected readonly rows: GridRow[] = Array.from({ length: 40 }, (_, id) => {
        const rule = RULES[id] ?? RULES[id % 2];

        return {
            id,
            name: rule.name,
            scope: id % 2 === 0 || id === 3 ? 'Личное' : 'Общее',
            rule: rule.code,
            category: rule.category,
            status: RULE_STATUSES[id % RULE_STATUSES.length],
            source: rule.source,
            owner: OWNERS[id % OWNERS.length],
            schedule: SCHEDULES[id % SCHEDULES.length],
            updatedAt: `24.11.2026, 14:${String(59 - id).padStart(2, '0')}`,
            description: rule.description,
            nextStep: rule.nextStep,
            channel: CHANNELS[id % CHANNELS.length]
        };
    });

    protected readonly columnDefs: ColDef<GridRow>[] = [
        {
            field: 'name',
            headerName: 'Name',
            width: 184,
            cellClass: 'rule-name',
            tooltipField: 'name',
            pinned: 'left',
            lockPinned: true,
            lockPosition: 'left',
            suppressMovable: true
        },
        { field: 'scope', headerName: 'Доступ', width: 116 },
        { field: 'rule', headerName: 'Код правила', width: 180, cellClass: 'rule-code' },
        { field: 'category', headerName: 'Категория', width: 152 },
        { field: 'status', headerName: 'Статус', width: 152 },
        { field: 'source', headerName: 'Источник данных', width: 168 },
        { field: 'owner', headerName: 'Владелец', width: 192 },
        { field: 'schedule', headerName: 'Период проверки', width: 162 },
        { field: 'updatedAt', headerName: 'Последнее изменение', width: 176 },
        { field: 'description', headerName: 'Условие', width: 368 },
        { field: 'nextStep', headerName: 'Действие при срабатывании', width: 380 },
        { field: 'channel', headerName: 'Канал уведомлений', width: 190 }
    ];
    protected readonly rowSelection: RowSelectionOptions<GridRow> = { mode: 'multiRow' };
    protected readonly selectionColumn: SelectionColumnDef = {
        width: 40,
        minWidth: 40,
        maxWidth: 40,
        pinned: 'left',
        lockPinned: true,
        lockPosition: 'left',
        suppressMovable: true
    };
    protected readonly rowClassRules: RowClassRules<GridRow> = {
        'workspace__row-current': ({ data }) => data?.id === (this.selectedRow()?.id ?? 1)
    };

    protected selectInitialRows({ api }: FirstDataRenderedEvent<GridRow>): void {
        const nodes = [api.getDisplayedRowAtIndex(5), api.getDisplayedRowAtIndex(6)];
        api.setNodesSelected({ nodes: nodes.filter((node) => node !== undefined), newValue: true });
    }

    protected updateSelection({ api }: SelectionChangedEvent<GridRow>): void {
        this.selectedCount.set(api.getSelectedNodes().length);
    }

    protected activateCell({ api, colDef, data }: CellClickedEvent<GridRow> | CellKeyDownEvent<GridRow>): void {
        if (!data || colDef.colId === SELECTION_COLUMN_ID) return;

        if (colDef.field === 'rule') {
            this.popoverOpen.update((open) => !open);
            return;
        }

        this.selectedRow.set(data);
        this.descriptionExpanded.set(false);
        this.opened.set(true);
        api.redrawRows();
    }

    protected activateCellWithKeyboard(event: CellKeyDownEvent<GridRow> | FullWidthCellKeyDownEvent<GridRow>): void {
        if ('colDef' in event && event.event instanceof KeyboardEvent && event.event.key === 'Enter') {
            this.activateCell(event);
        }
    }
}
