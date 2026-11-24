import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';
import { KbqContentPanelModule } from '@koobiq/components/content-panel';
import { KbqComponentColors, KbqOptionModule } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqInputModule } from '@koobiq/components/input';
import { KbqNativeScrollbar } from '@koobiq/components/scrollbar';
import { KbqSelectModule } from '@koobiq/components/select';
import { KbqTopBarModule } from '@koobiq/components/top-bar';
import { AgGridAngular } from 'ag-grid-angular';
import {
    AllCommunityModule,
    CellClickedEvent,
    ColDef,
    FirstDataRenderedEvent,
    ModuleRegistry,
    RowSelectionOptions
} from 'ag-grid-community';

import { ShadowStore } from '../model/shadow-store';

ModuleRegistry.registerModules([AllCommunityModule]);

interface EventRow {
    time: string;
    host: string;
    event: string;
    severity: string;
    source: string;
    user: string;
    address: string;
    segment: string;
    target: string;
    status: string;
    team: string;
    comment: string;
}

const HOSTS = ['web-01.corp', 'db-02.corp', 'mail.corp', 'web-03.corp', 'vpn.corp', 'ad.corp', 'fs-01.corp'];
const EVENTS = [
    'Подбор пароля',
    'Сканирование портов',
    'Фишинговое письмо',
    'Вредоносный файл',
    'Вход из новой страны'
];
const SEVERITIES = ['Низкая', 'Средняя', 'Высокая', 'Критичная'];
const USERS = ['a.petrov', 'm.ivanova', 'svc-backup', 'k.smirnov', 'root'];
const SEGMENTS = ['Серверная сеть', 'Офисная сеть', 'Почтовый контур', 'Удалённый доступ'];
const TARGETS = ['Служба аутентификации', 'Сетевое соединение', 'Входящее письмо', 'Вложение', 'Сеанс VPN'];
const COMMENTS = [
    'Сверить попытки входа с журналом аутентификации',
    'Проверить источник сетевых запросов',
    'Уточнить, кто получил письмо',
    'Передать файл на анализ',
    'Подтвердить вход у владельца учётной записи'
];

/**
 * Грид и открытая контент-панель — по примеру Кубика `ag-grid-and-content-panel`: AG Grid на
 * токенах Кубика, панель носит выбранный уровень тени, её край и показывает разницу уровней.
 */
@Component({
    selector: 'app-events-workspace-scene',
    imports: [
        AgGridAngular,
        FormsModule,
        KbqAgGridThemeModule,
        KbqFormFieldModule,
        KbqOptionModule,
        KbqSelectModule,
        KbqButtonModule,
        KbqButtonToggleModule,
        KbqContentPanelModule,
        KbqIconModule,
        KbqInputModule,
        KbqNativeScrollbar,
        KbqTopBarModule
    ],
    template: `
        <section class="scene">
            <div class="scene__head">
                <h2 class="scene__title">Контент-панель и грид событий</h2>
                <kbq-button-toggle-group
                    data-target="events-panel-elevation"
                    aria-label="Тень контент-панели событий"
                    [value]="store.panel()"
                    [disabled]="store.locked()"
                    (change)="store.setPanel($event.value)"
                >
                    <kbq-button-toggle value="none">Обводка</kbq-button-toggle>
                    <kbq-button-toggle value="card">Card</kbq-button-toggle>
                    <kbq-button-toggle value="popup">Popup</kbq-button-toggle>
                    <kbq-button-toggle value="overlay">Overlay</kbq-button-toggle>
                </kbq-button-toggle-group>
            </div>
            <p class="scene__note">
                Выберите строку, чтобы открыть событие. Контент-панель использует выбранный уровень тени в «Стало» и
                обводку в «Было». Открытый селект показывает тень Popup.
            </p>

            <div class="workspace">
                <kbq-content-panel-container
                    class="workspace__container"
                    width="400"
                    minWidth="320"
                    maxWidth="520"
                    [useStateSaving]="false"
                    [(opened)]="opened"
                >
                    <div class="workspace__main">
                        <kbq-top-bar class="workspace__topbar">
                            <div kbqTopBarContainer placement="start">
                                <span kbqTopBarTitle
                                    >События <span class="workspace__count">{{ rows.length }}</span></span
                                >
                            </div>
                            <div kbqTopBarContainer placement="end" inert>
                                <button kbq-button type="button" color="contrast">Primary Action</button>
                            </div>
                        </kbq-top-bar>
                        <div class="workspace__filters">
                            <button kbq-button kbqStyle="outline" type="button" inert>
                                <i kbq-icon="kbq-list-ul_16" kbqButtonPrefix></i> Фильтры
                            </button>
                            <kbq-form-field class="workspace__search">
                                <i kbq-icon="kbq-magnifying-glass_16" kbqPrefix></i>
                                <input
                                    #eventSearch
                                    kbqInput
                                    type="search"
                                    placeholder="Поиск"
                                    aria-label="Поиск событий"
                                    (input)="search.set(eventSearch.value)"
                                />
                            </kbq-form-field>
                        </div>
                        <ag-grid-angular
                            class="workspace__grid"
                            kbqAgGridTheme
                            kbqNativeScrollbar
                            kbqNativeScrollbarDescendants
                            [rowHeight]="40"
                            [headerHeight]="40"
                            [quickFilterText]="search()"
                            [rowSelection]="rowSelection"
                            [columnDefs]="columnDefs"
                            [defaultColDef]="defaultColDef"
                            [rowData]="rows"
                            (firstDataRendered)="selectInitialRow($event)"
                            (cellClicked)="select($event)"
                        />
                    </div>

                    <kbq-content-panel
                        class="workspace__panel"
                        [class.workspace__panel_elevated]="panelElevated()"
                        [style.box-shadow]="panelShadow()"
                    >
                        <kbq-content-panel-header>
                            <div class="panel-title" kbqContentPanelHeaderTitle>
                                {{ selected().event }}
                            </div>
                            <div class="panel-caption">{{ selected().host }} · {{ selected().time }}</div>
                        </kbq-content-panel-header>
                        <kbq-content-panel-body>
                            <div class="status" aria-hidden="true">
                                <kbq-form-field>
                                    <kbq-label>Статус</kbq-label>
                                    <kbq-select name="status" tabindex="-1" [ngModel]="statuses[1]">
                                        @for (status of statuses; track status) {
                                            <kbq-option [value]="status">{{ status }}</kbq-option>
                                        }
                                    </kbq-select>
                                </kbq-form-field>
                                <div class="kbq-select__panel status__panel" data-target="panel-select">
                                    <div class="kbq-select__content">
                                        @for (status of statuses; track status; let i = $index) {
                                            <kbq-option [value]="status" [class.kbq-selected]="i === 1">
                                                {{ status }}
                                            </kbq-option>
                                        }
                                    </div>
                                </div>
                            </div>

                            <dl class="panel-details">
                                <dt>Узел</dt>
                                <dd>{{ selected().host }}</dd>
                                <dt>Источник</dt>
                                <dd>{{ selected().source }}</dd>
                                <dt>Пользователь</dt>
                                <dd>{{ selected().user }}</dd>
                            </dl>
                            <p>
                                Событие сопоставлено с правилом корреляции. Проверьте журнал узла и активность
                                пользователя за последний час, затем решите, нужно ли изолировать узел.
                            </p>
                        </kbq-content-panel-body>
                        <kbq-content-panel-footer>
                            <button kbq-button [color]="colors.Contrast">Изолировать</button>
                            <button kbq-button [color]="colors.ContrastFade">Создать инцидент</button>
                        </kbq-content-panel-footer>
                    </kbq-content-panel>
                </kbq-content-panel-container>
            </div>
        </section>
    `,
    styles: `
        @use './scene';

        .workspace {
            box-sizing: border-box;
            /* Пример выше прочих сцен: гриду нужно больше строк на виду. */
            height: 640px;
            background: var(--kbq-background-bg);
            /* Рамки нет: пример читается фоном, а край панели рисует её тень. */
            /* Тень панели не выходит за границы примера: clip режет по краю, не заводя прокрутку. */
            overflow: clip;
        }

        /* Контейнер Кубика обрезает overflow, а с ним и тень панели. */
        .workspace__container {
            display: flex;
            height: 100%;
            overflow: visible;
        }

        /* Колонка грида: грид прокручивается сам, шапку держит его внутренний вьюпорт. */
        .workspace__main {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-width: 0;
        }

        .workspace__topbar {
            --kbq-top-bar-size-content-padding-horizontal: var(--kbq-size-xxl);
            flex: none;
        }

        .workspace__count {
            color: var(--kbq-foreground-contrast-secondary);
        }

        .workspace__filters {
            display: flex;
            align-items: center;
            gap: var(--kbq-size-s);
            padding: var(--kbq-size-s) var(--kbq-size-xxl);
        }

        .workspace__search {
            width: 240px;
            min-width: 0;
        }

        .scene {
            container-type: inline-size;
        }

        @container (max-width: 720px) {
            @include scene.stack-content-panel(360px, 430px);
        }

        .workspace__grid {
            display: block;
            flex: 1;
            min-height: 0;
            margin-inline-start: var(--kbq-size-xxl);
            --ag-row-border-color: var(--kbq-line-contrast-less);
        }

        .workspace ::ng-deep {
            .ag-row.ag-row-selected {
                background: var(--kbq-background-theme-less);
            }

            .kbq-content-panel-container__scrollbar {
                min-width: 0;
            }

            .kbq-content-panel-container__panel {
                padding: 0;
            }
        }

        /*
         * Скроллбары грида красит директива Кубика (kbqNativeScrollbar на самом гриде): трек
         * и ползунок с зазором и скруглением берутся из токенов scrollbar, состояние наведения —
         * тоже. Своих правил не держим: вьюпорты создаёт AG Grid, поэтому классы директивы
         * достают их как потомков. На macOS AG Grid прячет рельсы в оверлей (ag-apple-scrollbar)
         * и показывает их только во время прокрутки — возвращаем рельсы в поток, чтобы полоса
         * стояла на месте, как у Кубика. Зонд ширины скроллбара AG Grid вешает на body, поэтому
         * директива на него не влияет и apple-режим надо гасить вручную.
         */
        .workspace ::ng-deep {
            .ag-body-vertical-scroll.ag-scrollbar-invisible.ag-apple-scrollbar,
            .ag-body-horizontal-scroll.ag-scrollbar-invisible.ag-apple-scrollbar {
                position: relative;
                visibility: visible;
                opacity: 1;
            }
        }

        /* Flex-ребёнок обёртки ресайзера: без нуля его распирает содержимое шапки и футера. */
        .workspace__panel {
            --kbq-content-panel-border-radius: 0px;
            min-width: 0;
        }

        /* С уровнем тени обводка не нужна: край рисует outline-слой тени. */
        .workspace__panel_elevated {
            --kbq-content-panel-border: none;
        }

        /* Открытый селект: копия панели лежит поверх текста под полем. */
        .status {
            position: relative;
            width: 200px;
            margin-bottom: var(--kbq-size-l);
            pointer-events: none;
        }

        .status kbq-form-field {
            width: 100%;
        }

        /* Как у настоящего селекта: не уже поля, а длинный вариант растягивает панель. */
        .status__panel {
            position: absolute;
            z-index: 1;
            top: calc(100% + var(--kbq-size-xxs));
            left: 0;
            width: max-content;
            min-width: 100%;
        }

        .panel-caption {
            margin-top: var(--kbq-size-xxs);
            color: var(--kbq-foreground-contrast-secondary);
        }

        .panel-details {
            display: grid;
            grid-template-columns: max-content 1fr;
            gap: var(--kbq-size-s) var(--kbq-size-l);
            margin: 0 0 var(--kbq-size-l);

            dt {
                color: var(--kbq-foreground-contrast-secondary);
            }

            dd {
                margin: 0;
            }
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventsWorkspaceScene {
    protected readonly store = inject(ShadowStore);
    protected readonly colors = KbqComponentColors;

    protected readonly statuses = ['Новое', 'В работе', 'Ложное срабатывание', 'Закрыто'];
    protected readonly opened = signal(true);
    protected readonly search = signal('');
    /**
     * В «Было» панель стоковая: у контент-панели Кубика тени нет вовсе, край рисует обводка, —
     * поэтому выбранный уровень из «Стало» на неё не переносится.
     */
    protected readonly panelShadow = computed(() => {
        if (this.store.locked()) {
            return null;
        }

        const level = this.store.panel();

        return level === 'none' ? null : `var(--kbq-shadow-${level})`;
    });

    /* Обводку снимает только «Стало»: там край рисует outline-слой тени. */
    protected readonly panelElevated = computed(() => this.panelShadow() !== null);

    /* Фиксированные ширины плюс тянущаяся «Событие»: колонок больше, чем места, поэтому грид листается вбок. */
    protected readonly columnDefs: ColDef<EventRow>[] = [
        { field: 'time', headerName: 'Время', width: 88 },
        { field: 'host', headerName: 'Узел', width: 124 },
        { field: 'event', headerName: 'Событие', flex: 1, minWidth: 180 },
        { field: 'severity', headerName: 'Важность', width: 116 },
        { field: 'source', headerName: 'Источник', width: 112 },
        { field: 'user', headerName: 'Пользователь', width: 148 },
        { field: 'address', headerName: 'IP-адрес', width: 132 },
        { field: 'segment', headerName: 'Сегмент', width: 160 },
        { field: 'target', headerName: 'Объект', width: 208 },
        { field: 'status', headerName: 'Статус', width: 184 },
        { field: 'team', headerName: 'Ответственная команда', width: 200 },
        { field: 'comment', headerName: 'Комментарий', width: 356 }
    ];
    protected readonly defaultColDef: ColDef = { resizable: true };
    /* Клик по строке и есть выбор: колонка чекбоксов в примере лишняя. */
    protected readonly rowSelection: RowSelectionOptions = {
        mode: 'singleRow',
        checkboxes: false,
        enableClickSelection: true
    };

    protected readonly rows: EventRow[] = Array.from({ length: 40 }, (_, i) => ({
        time: `14:${String(59 - i).padStart(2, '0')}`,
        host: HOSTS[i % HOSTS.length],
        event: EVENTS[(i * 3) % EVENTS.length],
        severity: SEVERITIES[(i * 7) % SEVERITIES.length],
        source: i % 2 ? 'EDR' : 'SIEM',
        user: USERS[i % USERS.length],
        address: `192.0.2.${i + 10}`,
        segment: SEGMENTS[i % SEGMENTS.length],
        target: TARGETS[(i * 3) % EVENTS.length],
        status: this.statuses[i % this.statuses.length],
        team: i % 2 ? 'Защита рабочих станций' : 'Центр мониторинга',
        comment: COMMENTS[(i * 3) % EVENTS.length]
    }));

    protected readonly selected = signal<EventRow>(this.rows[2]);

    protected select(event: CellClickedEvent<EventRow>): void {
        if (!event.data) return;

        this.selected.set(event.data);
        this.opened.set(true);
    }

    /** Панель открыта на третьей строке: подсветку ставит грид, у него своя модель выбора. */
    protected selectInitialRow({ api }: FirstDataRenderedEvent<EventRow>): void {
        api.getRowNode(String(this.rows.indexOf(this.selected())))?.setSelected(true);
    }
}
