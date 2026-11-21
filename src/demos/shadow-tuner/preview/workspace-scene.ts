import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqButtonModule } from '@koobiq/components/button';
import { KbqButtonToggleModule } from '@koobiq/components/button-toggle';
import { KbqContentPanelModule } from '@koobiq/components/content-panel';
import { KbqComponentColors, KbqOptionModule } from '@koobiq/components/core';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqNativeScrollbar } from '@koobiq/components/scrollbar';
import { KbqSelectModule } from '@koobiq/components/select';
import { AgGridModule } from 'ag-grid-angular';
import {
    AllCommunityModule,
    CellClickedEvent,
    ColDef,
    FirstDataRenderedEvent,
    ModuleRegistry,
    RowSelectionOptions,
    themeQuartz
} from 'ag-grid-community';

import { ShadowStore } from '../model/shadow-store';

ModuleRegistry.registerModules([AllCommunityModule]);

/** Тема грида повторяет Кубика переменными, а не значениями: тёмная тема переключается сама. */
const GRID_THEME = themeQuartz.withParams({
    backgroundColor: 'transparent',
    foregroundColor: 'var(--kbq-foreground-contrast)',
    borderColor: 'var(--kbq-line-contrast-less)',
    headerBackgroundColor: 'transparent',
    headerTextColor: 'var(--kbq-foreground-contrast-secondary)',
    rowHoverColor: 'var(--kbq-states-background-transparent-hover)',
    /* Выбранный контейнер в Кубике — theme-less (как выбранное в дереве); поверх ховера не теряется. */
    selectedRowBackgroundColor: 'var(--kbq-background-theme-less)',
    oddRowBackgroundColor: 'transparent',
    wrapperBorder: false,
    wrapperBorderRadius: '0',
    cellHorizontalPadding: 8,
    fontFamily: 'var(--kbq-font-family-base)',
    fontSize: 'var(--kbq-typography-text-normal-font-size)',
    headerFontSize: 'var(--kbq-typography-text-compact-font-size)',
    headerFontWeight: 400
});

interface EventRow {
    time: string;
    host: string;
    event: string;
    severity: string;
    source: string;
    user: string;
}

const HOSTS = ['web-01.corp', 'db-02.corp', 'mail.corp', 'web-03.corp', 'vpn.corp', 'ad.corp', 'fs-01.corp'];
const EVENTS = ['Подбор пароля', 'Сканирование портов', 'Фишинговое письмо', 'Вредоносный файл', 'Вход из новой страны'];
const SEVERITIES = ['Низкая', 'Средняя', 'Высокая', 'Критичная'];
const USERS = ['a.petrov', 'm.ivanova', 'svc-backup', 'k.smirnov', 'root'];

/**
 * Грид и открытая контент-панель — по примеру Кубика `ag-grid-and-content-panel`: AG Grid на
 * токенах Кубика, панель носит выбранный уровень тени, её край и показывает разницу уровней.
 */
@Component({
    selector: 'app-workspace-scene',
    imports: [
        FormsModule,
        AgGridModule,
        KbqFormFieldModule,
        KbqOptionModule,
        KbqSelectModule,
        KbqButtonModule,
        KbqButtonToggleModule,
        KbqContentPanelModule,
        KbqIconModule,
        KbqNativeScrollbar
    ],
    template: `
        <section class="scene">
            <div class="scene__head">
                <h2 class="scene__title">Контент-панель и грид</h2>
                <kbq-button-toggle-group
                    data-target="panel-elevation"
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
                В «Стало» панель носит тень Overlay; переключатель примеряет на неё другой уровень вместо обводки
                <code>--kbq-content-panel-border</code>. В «Было» панель стоковая — без тени и с обводкой, уровень
                на неё не действует. Открытый селект в панели — копия панели селекта на
                <code>--kbq-shadow-popup</code>, её тень здесь не переключается. Клик по строке грида меняет
                содержимое панели, в «Было» переключатель заблокирован.
            </p>

            <div class="workspace">
                <kbq-content-panel-container
                    class="workspace__container"
                    width="400"
                    minWidth="320"
                    maxWidth="520"
                    [(opened)]="opened"
                >
                <div class="workspace__main">
                    <ag-grid-angular
                        class="workspace__grid"
                        kbqNativeScrollbar
                        kbqNativeScrollbarDescendants
                        [theme]="gridTheme"
                        [style.height]="'100%'"
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

        /* Обёртка панели в Кубике отступает 0 8 8 0: добираем верх, чтобы панель стояла в равных полях. */
        .workspace ::ng-deep .kbq-content-panel-container__panel {
            padding-top: var(--kbq-size-s);
        }

        /* Контейнер Кубика обрезает overflow, а с ним и тень панели. */
        .workspace__container {
            display: flex;
            height: 100%;
            overflow: visible;
        }

        /* Колонка грида: грид прокручивается сам, шапку держит его внутренний вьюпорт. */
        .workspace__main {
            flex: 1 1 0;
            /* Высоту задаёт вьюпорт контейнера: без неё колонка растягивается по строкам и уезжает за рамку. */
            height: 100%;
            min-width: 0;
        }

        /* В узкой колонке грид и панель не помещаются рядом: содержимым демо остаётся панель. */
        @media (max-width: 640px) {
            .workspace__main {
                display: none;
            }
        }

        .workspace__grid {
            width: 100%;
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
export class WorkspaceScene {
    protected readonly store = inject(ShadowStore);
    protected readonly colors = KbqComponentColors;

    protected readonly statuses = ['Новое', 'В работе', 'Ложное срабатывание', 'Закрыто'];
    protected readonly opened = signal(true);
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
        { field: 'source', headerName: 'Источник', width: 104 }
    ];
    protected readonly defaultColDef: ColDef = { resizable: true };
    /* Клик по строке и есть выбор: колонка чекбоксов в примере лишняя. */
    protected readonly rowSelection: RowSelectionOptions = {
        mode: 'singleRow',
        checkboxes: false,
        enableClickSelection: true
    };
    protected readonly gridTheme = GRID_THEME;

    protected readonly rows: EventRow[] = Array.from({ length: 40 }, (_, i) => ({
        time: `14:${String(59 - i).padStart(2, '0')}`,
        host: HOSTS[i % HOSTS.length],
        event: EVENTS[(i * 3) % EVENTS.length],
        severity: SEVERITIES[(i * 7) % SEVERITIES.length],
        source: i % 2 ? 'EDR' : 'SIEM',
        user: USERS[(i * 5) % USERS.length]
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
