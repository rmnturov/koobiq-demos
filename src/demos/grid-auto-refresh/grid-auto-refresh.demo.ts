import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  computed,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  EnvironmentInjector,
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
import { KbqDlModule } from '@koobiq/components/dl';
import { KbqDropdownModule } from '@koobiq/components/dropdown';
import { KbqFilter, KbqFilterBarModule } from '@koobiq/components/filter-bar';
import { KbqMarkdown } from '@koobiq/components/markdown';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqLink } from '@koobiq/components/link';
import { KbqOverflowItemsModule } from '@koobiq/components/overflow-items';
import { KbqToastService, KbqToastStyle } from '@koobiq/components/toast';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
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
import { createDemoToastScope } from './demo-toast-scope';
import { AnimatedNoticeText } from './animated-notice-text';
import { MenuItemHint } from './menu-item-hint';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'grid-auto-refresh-demo',
  imports: [
    AnimatedNoticeText,
    MenuItemHint,
    NgTemplateOutlet,
    KbqMarkdown,
    KbqLuxonDateModule,
    AgGridAngular,
    KbqAgGridThemeModule,
    KbqActionsPanelModule,
    KbqButtonModule,
    KbqContentPanelModule,
    KbqDlModule,
    KbqDropdownModule,
    KbqFilterBarModule,
    KbqIconModule,
    KbqLink,
    KbqOverflowItemsModule,
    KbqToolTipModule,
    KbqTopBarModule,
  ],
  providers: [KbqActionsPanel, DateFormatter],
  templateUrl: './grid-auto-refresh.demo.html',
  styleUrl: './grid-auto-refresh.demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridAutoRefreshDemo {
  readonly articleText = `# Автообновление в таблице

Автообновление помогает следить за новыми инцидентами и сохраняет список на месте, пока человек с ним работает.

## Новые записи сверху

Таблица проверяет новые данные с заданным периодом. Период можно настроить или выключить автообновление. Если список еще не трогали, новые инциденты появляются сверху. Добавленные строки один раз плавно подсвечиваются. Подсветка складывается с фоном активной или выбранной строки и затем гаснет.

Кнопка **Обновить** работает в любом режиме. Если новых инцидентов нет, список остается прежним.

## Список сохраняется во время работы

Когда человек прокручивает таблицу, выбирает строки или открывает карточку, новые записи перестают вставляться сами. Строки остаются на месте, чтобы не сбить чтение и выбор. Сортировка, отличная от новых записей сверху, тоже приостанавливает автоматическую вставку.

Проверки продолжаются. О новых инцидентах сообщает компактная панель под заголовками колонок. Она остается видимой при прокрутке. Возврат к началу списка, снятие выбора или закрытие карточки сами по себе не включают вставку новых строк: сначала нужно обновить список.

## Панель новых записей

Число в панели показывает, сколько новых инцидентов подходит под текущие фильтры. Повторная проверка не считает одну запись дважды. При новых поступлениях число меняется с анимацией, а ширина панели плавно подстраивается под текст.

Нажатие на часть панели с числом показывает новые записи и возвращает к началу таблицы. Крестик скрывает сообщение, но сохраняет накопленные записи. Панель появится снова, когда поступит еще хотя бы один подходящий инцидент.

Если точное число недоступно, панель сообщает «Есть новые записи». Нажатие на сообщение показывает эти записи, а крестик скрывает сообщение.

## Обновление по команде

Кнопка **Обновить** и панель новых записей загружают актуальный список с прежними фильтрами и сортировкой. Таблица плавно возвращается к началу. Обычно сначала видны 50 строк; следующие появляются по мере прокрутки вниз. Если активная или отмеченная флажком строка оказалась ниже, список подгружается до нее.

После нажатия на всплывающее уведомление о новых записях или кнопку **Обновить** активная строка сохраняет голубой фон, а ее карточка получает свежие данные, если инцидент остался в новой выборке. Если его больше нет в выборке, карточка закрывается.

Строки, отмеченные флажками, сохраняют выделение, если все они остались в новой выборке. Панель массовых действий остается открытой. Если пропал хотя бы один выделенный инцидент, снимается все выделение и панель закрывается.

Пока есть выбранные строки, открытая карточка или сортировка, отличная от новых записей сверху, последующие поступления снова накапливаются в панели.

Во время обновления кнопка **Обновить** показывает ход загрузки и сохраняет подпись. Панель новых записей остается доступной: ее можно нажать, даже если проверка уже идет.

## Фильтры, выбор и карточка

Поиск и фильтры обновляют список под выбранные условия и возвращают к началу таблицы. Счетчик рядом с заголовком показывает число инцидентов в текущей выборке, включая те, до которых еще не прокрутили. При прокрутке вправо флажки и ID остаются видимыми.

Нажатие на строку открывает карточку справа. Нажатие на другую строку меняет содержимое карточки. Флажки выбирают инциденты для массовых действий; панель действий появляется поверх нижней части таблицы.

## Ошибка связи

При ошибке таблица сохраняет строки, выбор, карточку и число новых записей. В правом верхнем углу таблицы появляется тост с кнопкой **Повторить**. Номер попытки показывается начиная со второй.

Если автообновление включено, в серой подписи идет обратный отсчет до следующей попытки. После каждой ошибки пауза увеличивается, но не превышает двух минут. Тост остается между автоматическими попытками: текст обновляется в том же сообщении, а отсчет до закрытия начинается заново. Наведение и фокус приостанавливают закрытие тоста, но не автоматическую попытку.

Кнопка **Повторить** закрывает тост и сразу запускает обновление. Если попытка снова не удалась, появляется новый тост с ошибкой. При успехе сообщение остается закрытым.

Крестик закрывает сообщение, но не отменяет автоматические попытки. При следующей ошибке сообщение появится снова. После успешного обновления тост закрывается, номер попытки сбрасывается, проверки возвращаются к выбранному интервалу.

Если автообновление выключено, тост содержит подпись «Автообновление выключено», а повтор запускается по кнопке. Без взаимодействия тост закроется через 5 секунд.

## Возврат на вкладку

Пока вкладка скрыта, проверки приостановлены. При возвращении данные проверяются сразу, если автообновление включено. Если до ухода человек работал со списком, новые записи попадут в панель, а строки сохранят положение.

## Управление примером

В примере инциденты вымышленные и поступают сами: иногда по несколько сразу, иногда с паузами. Обновление, фильтры, выбор строк и карточка показывают рабочее поведение таблицы.

Для этого примера выбран период проверки **5 секунд**, чтобы быстрее увидеть новые записи. Кнопка **Каждые 5 с** в верхней панели позволяет выбрать другой период или выключить автообновление. Настройка периода показана в [демо меню параметров таблицы](/demo/drilldown-menu).

Следующие элементы нужны для демонстрации и проверки сценариев:

- **Точное число** переключает панель новых записей между счетчиком и сообщением «Есть новые записи». Вариант **Без точного числа** имитирует ситуацию, когда число новых инцидентов недоступно.
- **Белое уведомление**, **Серое уведомление**, **Синее уведомление** или **Светло-синее уведомление** — кнопка показывает выбранное оформление панели новых записей и позволяет его сменить.
- **Подсветка: 1 с** позволяет выбрать длительность подсветки новых строк: 0,5, 1, 2 или 3 секунды. По умолчанию выбрана одна секунда. Выбранная длительность применяется при следующем обновлении списка.
- **Стиль: Градиент** переключает временное обозначение новых строк. Доступны семь вариантов: сплошная заливка, градиент слева направо, полоса слева, рамка строки, подчеркивание, диагональная штриховка и мягкое свечение в центре строки. Градиент занимает первые 200 пикселей слева и плавно переходит от голубого к прозрачному, независимо от ширины таблицы. По умолчанию выбран градиент. Все варианты плавно появляются и гаснут за выбранное время, сохраняя фон активных и отмеченных строк.
- **Ошибка связи** имитирует разрыв соединения. При следующей проверке появится тост с ошибкой. Кнопка меняется на **Восстановить связь**, чтобы завершить этот сценарий.
- **Сценарий** подготавливает таблицу для наблюдения за поступлениями, работы с выбранными строками или просмотра карточки.
- **Сброс примера** в шапке страницы возвращает демо в начальное состояние.
- Действия в карточке и панели массовых действий показывают уведомления. Они не меняют инциденты в примере.

Если места в верхней панели не хватает, часть команд находится в меню **Еще**.
`;

  readonly server = new IncidentServer();
  readonly state = new AutoRefreshController(this.server);
  protected readonly retryCaption = computed(() => {
    const busy = this.state.busy();
    const attempt = this.state.failedAttempts() + Number(busy);
    const seconds = this.state.secondsUntilCheck();
    const status = busy
      ? 'Повторное обновление'
      : seconds !== null
        ? `Следующая попытка через ${seconds} с`
        : 'Автообновление выключено';
    return attempt > 1 ? `Попытка ${attempt}. ${status}` : status;
  });
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
  readonly noticeText = signal('');
  readonly instantNoticeExit = signal(false);
  private noticeActivation = 0;
  private readonly noticePanel = viewChild('newRecordsPanel', {
    read: ElementRef<HTMLElement>,
  });
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
  readonly intervals = [0, 5000, 15000, 30000, 60000];
  readonly noticeStyle = signal<'neutral' | 'contrast-fade' | 'theme' | 'theme-fade'>('neutral');
  readonly noticeStyles = [
    { id: 'neutral', label: 'Белое' },
    { id: 'contrast-fade', label: 'Серое' },
    { id: 'theme', label: 'Синее' },
    { id: 'theme-fade', label: 'Светло-синее' },
  ] as const;
  readonly noticeStyleLabel = computed(
    () => this.noticeStyles.find(({ id }) => id === this.noticeStyle())!.label,
  );
  readonly highlightDurations = [
    { ms: 500, label: '0,5 с' },
    { ms: 1000, label: '1 с' },
    { ms: 2000, label: '2 с' },
    { ms: 3000, label: '3 с' },
  ];
  readonly highlightDurationLabel = computed(
    () => this.highlightDurations.find(({ ms }) => ms === this.state.highlightDurationMs())!.label,
  );
  readonly highlightStyle = signal<
    'solid' | 'gradient' | 'stripe' | 'outline' | 'underline' | 'hatch' | 'glow'
  >('gradient');
  readonly highlightStyles = [
    { id: 'solid', label: 'Сплошная заливка' },
    { id: 'gradient', label: 'Градиент' },
    { id: 'stripe', label: 'Полоса слева' },
    { id: 'outline', label: 'Рамка строки' },
    { id: 'underline', label: 'Подчеркивание' },
    { id: 'hatch', label: 'Штриховка' },
    { id: 'glow', label: 'Свечение' },
  ] as const;
  readonly highlightStyleLabel = computed(
    () => this.highlightStyles.find(({ id }) => id === this.highlightStyle())!.label,
  );
  readonly controls = [
    'refresh',
    'interval',
    'count',
    'appearance',
    'highlight',
    'highlightStyle',
    'connection',
    'scenario',
  ];
  readonly controlHints = {
    refresh: 'Показать актуальные инциденты и вернуться к началу таблицы',
    interval: 'Период автообновления',
    count: 'Проверить панель новых записей с точным числом и без него',
    appearance: 'Сравнить четыре варианта оформления панели новых записей',
    highlight: 'Длительность подсветки новых строк',
    highlightStyle: 'Стиль подсветки новых строк',
    disconnect: 'Имитировать ошибку связи при следующем обновлении',
    restore: 'Завершить имитацию ошибки связи',
    scenario: 'Подготовить таблицу для проверки одного из сценариев',
    exactCount: 'Показать число новых инцидентов, подходящих под текущие фильтры',
    unknownCount: 'Имитировать отсутствие точного числа новых инцидентов',
    observe: 'Закрыть карточку, снять выбор и показать актуальный список',
    select: 'Выбрать две первые строки и открыть панель массовых действий',
    card: 'Открыть карточку первого инцидента',
    action: 'Демонстрационное действие: показать уведомление без изменения инцидентов',
  };
  readonly cardActions = [
    { id: 'assign', label: 'Назначить', feedback: 'Назначение оператора' },
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
  readonly rowClasses = computed<RowClassRules<Incident>>(() => {
    const activeId = this.state.card()?.id;
    return {
      'incident-active-row': ({ data }) => !!data && data.id === activeId,
      'incident-new-row': ({ data }) =>
        !!data &&
        Date.now() - (this.state.lastApplied() ?? 0) < this.state.appliedHighlightDurationMs() &&
        this.state.newlyAppliedIds().includes(data.id),
    };
  });
  readonly arrivalStyle = () => ({
    '--incident-arrival-duration': `${this.state.appliedHighlightDurationMs()}ms`,
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
      width: 168,
      minWidth: 168,
      cellRenderer: IncidentIdCell,
      pinned: 'left',
      lockPinned: true,
      lockPosition: 'left',
      suppressMovable: true,
    },
    { field: 'name', headerName: 'Название', width: 240 },
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
      width: 100,
      minWidth: 100,
      valueFormatter: ({ data }) => (data ? STATUS_LABELS[data.status] : ''),
    },
    { field: 'assignee', headerName: 'Оператор', width: 180 },
    { field: 'source', headerName: 'Источник', width: 185 },
    {
      field: 'updatedAt',
      headerName: 'Изменен',
      width: 200,
      valueFormatter: ({ value }) => this.formatDate(value),
    },
    {
      field: 'createdAt',
      headerName: 'Зарегистрирован',
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
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly previewCard = viewChild<ElementRef<HTMLElement>>('previewCard');
  private readonly toasts = signal<KbqToastService | null>(null);
  private toastScope?: EnvironmentInjector;
  private errorToast: ReturnType<KbqToastService['show']> | null = null;
  private readonly retryToastActions =
    viewChild.required<TemplateRef<unknown>>('retryToastActions');
  private readonly retryToastCaption =
    viewChild.required<TemplateRef<unknown>>('retryToastCaption');
  private previousToastAttempt = 0;
  private previousToastRetryDelay = 0;
  private errorToastRemainingMs = 0;

  constructor() {
    const destroy = inject(DestroyRef);
    effect(() => {
      if (this.state.pendingNoticeVisible()) this.instantNoticeExit.set(false);
    });
    effect(() => {
      // Keep the last label during exit, after the pending count has already reset.
      if (this.state.pendingNoticeVisible()) this.noticeText.set(this.state.pendingText());
    });
    afterNextRender(() => {
      const resize = new ResizeObserver(([entry]) =>
        this.workspaceWidth.set(entry.contentRect.width),
      );
      resize.observe(this.host.nativeElement);
      destroy.onDestroy(() => resize.disconnect());
      const preview = this.previewCard()!;
      this.toastScope = createDemoToastScope(preview.nativeElement, this.environmentInjector);
      const toasts = this.toastScope.get(KbqToastService);
      this.toasts.set(toasts);
      const toastTimer = toasts.timer.subscribe(() => {
        if (!this.errorToast || !toasts.toasts.includes(this.errorToast.ref)) return;
        if (this.state.busy() || document.hidden) return;
        this.errorToastRemainingMs -= 500;
        if (this.errorToastRemainingMs <= 0) toasts.hide(this.errorToast.id);
      });
      destroy.onDestroy(() => toastTimer.unsubscribe());
      this.ready.set(true);
      this.state.start();
      void this.state.setVisibility(document.hidden);
    });
    const visibility = () => void this.state.setVisibility(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    destroy.onDestroy(() => {
      this.state.destroy();
      document.removeEventListener('visibilitychange', visibility);
      this.toastScope?.destroy();
      this.panelRef?.close();
    });
    effect(() => {
      const toasts = this.toasts();
      const error = this.state.error();
      const busy = this.state.busy();
      const attempt = this.state.failedAttempts();
      const retryDelay = this.state.retryDelayMs();
      const failed = attempt > this.previousToastAttempt;
      if (!toasts) return;
      if (!error) {
        if (this.errorToast) toasts.hide(this.errorToast.id);
        this.errorToast = null;
        this.previousToastAttempt = 0;
        this.previousToastRetryDelay = 0;
        this.errorToastRemainingMs = 0;
        return;
      }
      const active = this.errorToast && toasts.toasts.includes(this.errorToast.ref);
      if (!active && failed && !busy) {
        this.errorToast = toasts.show(
          {
            style: KbqToastStyle.Error,
            title: error,
            caption: this.retryToastCaption(),
            actions: this.retryToastActions(),
            closeButton: true,
          },
          0,
        );
      }
      if (this.errorToast && toasts.toasts.includes(this.errorToast.ref)) {
        if (failed || retryDelay !== this.previousToastRetryDelay)
          this.errorToastRemainingMs = Math.max(5000, retryDelay + 5000);
      }
      this.previousToastAttempt = attempt;
      this.previousToastRetryDelay = retryDelay;
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

  async showNewRecords(event: MouseEvent): Promise<void> {
    const activation = ++this.noticeActivation;
    this.instantNoticeExit.set(event.detail === 0);
    const request = this.state.refresh();
    const focusTarget = this.focusOutsideNotice();
    if (!(await request)) {
      if (activation === this.noticeActivation) this.instantNoticeExit.set(false);
      return;
    }
    afterNextRender(
      () => {
        if (activation === this.noticeActivation && !this.state.pendingNoticeVisible()) {
          this.focusOutsideNotice(focusTarget);
        }
      },
      { injector: this.injector },
    );
  }

  dismissNewRecords(event: MouseEvent): void {
    this.noticeActivation++;
    this.instantNoticeExit.set(event.detail === 0);
    this.focusOutsideNotice();
    this.state.dismissPendingNotice();
  }

  private focusOutsideNotice(previousTarget?: Element): HTMLButtonElement | undefined {
    const active = document.activeElement;
    if (
      active &&
      active !== document.body &&
      active !== previousTarget &&
      !this.noticePanel()?.nativeElement.contains(active)
    )
      return;
    const preferred = this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
      '[data-control="refresh"], .topbar button[kbqOverflowItemsResult]',
    );
    const fallback = this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.topbar button');
    const target = [...preferred, ...fallback].find(
      (candidate) =>
        !candidate.disabled &&
        !(this.state.busy() && candidate.getAttribute('data-control') === 'refresh') &&
        !candidate.closest('[aria-hidden="true"]') &&
        candidate.getClientRects().length > 0,
    );
    target?.focus();
    return target;
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
    this.syncHighlightGradient(event.api);
  }
  syncHighlightGradient(api: GridApi<Incident>): void {
    const area = this.gridArea()?.nativeElement;
    if (!area || api.isDestroyed()) return;
    const pinnedStart = api
      .getDisplayedLeftColumns()
      .reduce((width, col) => width + col.getActualWidth(), 0);
    const pinnedEnd = api
      .getDisplayedRightColumns()
      .reduce((width, col) => width + col.getActualWidth(), 0);
    const { left, right } = api.getHorizontalPixelRange();
    const width = pinnedStart + right - left + pinnedEnd;
    // All row segments share one gradient, including pinned columns and horizontal scrolling.
    area.style.setProperty('--incident-gradient-width', `${width}px`);
    area.style.setProperty('--incident-gradient-center-offset', `${left - pinnedStart}px`);
    area.style.setProperty('--incident-gradient-end-offset', `${pinnedEnd - width}px`);
  }
  selectionChanged(event: SelectionChangedEvent<Incident>): void {
    if (!this.syncing && event.source !== 'rowDataChanged' && event.source !== 'api')
      this.state.setSelection(event.api.getSelectedRows().map((row) => row.id));
  }
  scrolled(event: BodyScrollEvent<Incident>): void {
    if (event.direction === 'horizontal') this.syncHighlightGradient(event.api);
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
  retryUpdate(): void {
    if (this.errorToast) this.toasts()?.hide(this.errorToast.id);
    this.errorToast = null;
    this.errorToastRemainingMs = 0;
    void this.state.refresh();
  }
  toggleConnection(): void {
    this.server.offline = !this.server.offline;
    if (!this.server.offline) void this.state.poll();
  }
  notify(message: string): void {
    this.toasts()?.show({ title: message, closeButton: true });
  }
  formatDate(value: number | null): string {
    return value === null
      ? 'ещё не выполнялась'
      : this.dateFormatter.absoluteShortDateTime(this.dateFormatter.adapter.parse(value, null), {
          seconds: true,
        });
  }
}
