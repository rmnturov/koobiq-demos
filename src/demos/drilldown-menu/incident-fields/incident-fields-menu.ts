import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KbqButtonModule } from '@koobiq/components/button';
import {
  KbqHighlightBackgroundPipe,
  KbqOptgroup,
  KbqPseudoCheckbox,
} from '@koobiq/components/core';
import { KbqDropdownItem } from '@koobiq/components/dropdown';
import { KbqFormFieldModule } from '@koobiq/components/form-field';
import { KbqIconModule } from '@koobiq/components/icon';
import { KbqInputModule } from '@koobiq/components/input';
import { KbqToolTipModule } from '@koobiq/components/tooltip';
import { DrilldownMenuList } from '../menu/drilldown-menu-list';
import { DrilldownMenuScreen } from '../menu/drilldown-menu-screen';
import { DRILLDOWN_MENU } from '../menu/drilldown-menu.types';

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

const INCIDENT_FIELDS = INCIDENT_FIELD_GROUPS.flatMap((group) => group.fields);

@Component({
  selector: 'demo-incident-fields-menu',
  imports: [
    FormsModule,
    KbqButtonModule,
    KbqDropdownItem,
    KbqFormFieldModule,
    KbqHighlightBackgroundPipe,
    KbqIconModule,
    KbqInputModule,
    KbqOptgroup,
    KbqPseudoCheckbox,
    KbqToolTipModule,
    DrilldownMenuScreen,
  ],
  templateUrl: './incident-fields-menu.html',
  styleUrl: './incident-fields-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentFieldsMenu {
  readonly screenId = input.required<string>();
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly defaultFieldIds = input<readonly string[]>([]);
  readonly showTotal = input(false, { transform: booleanAttribute });
  protected readonly menu = inject(DRILLDOWN_MENU);
  protected readonly prefix = computed(() => `${this.menu.id}-${this.screenId()}`);
  protected readonly query = signal('');
  protected readonly searchTerm = computed(() => this.query().trim());
  protected readonly groups = computed(() => {
    const query = this.searchTerm().toLowerCase();
    return INCIDENT_FIELD_GROUPS.map((group) => ({
      ...group,
      fields: group.fields.filter((field) => field.label.toLowerCase().includes(query)),
    })).filter((group) => group.fields.length > 0);
  });
  private readonly visibleFields = computed(() => this.groups().flatMap((group) => group.fields));
  readonly selectedFieldIds = model.required<ReadonlySet<string>>();
  protected readonly activeFieldId = signal<string | null>(null);
  protected readonly caption = computed(() => {
    const selected = this.selectedFieldIds();
    if (this.showTotal()) return `${selected.size} из ${INCIDENT_FIELDS.length}`;
    if (selected.size > 1) return String(selected.size);
    return INCIDENT_FIELDS.find((field) => selected.has(field.id))?.label ?? '';
  });
  private readonly rootItem = viewChild.required('rootItem', { read: KbqDropdownItem });

  constructor() {
    const parentList = inject(DrilldownMenuList, { optional: true, skipSelf: true });
    effect((onCleanup) => {
      const item = this.rootItem();
      if (parentList) onCleanup(parentList.registerItem(item));
    });
  }

  protected setQuery(query: string): void {
    if (query.trim() !== this.searchTerm()) this.activeFieldId.set(null);
    this.query.set(query);
  }

  protected clearQuery(): void {
    this.query.set('');
    this.activeFieldId.set(null);
  }

  protected resetSelection(): void {
    this.selectedFieldIds.set(new Set(this.defaultFieldIds()));
    this.clearQuery();
  }

  protected clearSelection(): void {
    this.selectedFieldIds.set(new Set<string>());
    this.clearQuery();
  }

  protected selectField(fieldId: string): void {
    this.activeFieldId.set(fieldId);
    this.toggleField(fieldId);
    const search = this.menu
      .screenElement(this.screenId())
      ?.querySelector<HTMLInputElement>('[data-incident-search]');
    search?.focus({ preventScroll: true });
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (event.key === 'Escape' && this.query()) {
      event.preventDefault();
      event.stopPropagation();
      this.clearQuery();
      return;
    }
    const activeId = this.activeFieldId();
    if (event.key === 'Enter' && activeId) {
      event.preventDefault();
      if (!event.repeat) this.toggleField(activeId);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const fields = this.visibleFields();
    if (!fields.length) return;
    event.preventDefault();
    const index = fields.findIndex((field) => field.id === activeId);
    let nextIndex = Math.min(index + 1, fields.length - 1);
    if (event.key === 'ArrowUp') {
      nextIndex = index < 0 ? fields.length - 1 : Math.max(index - 1, 0);
    }
    const next = fields[nextIndex];
    this.activeFieldId.set(next.id);
    const option = document.getElementById(this.optionId(next.id));
    if (option) this.menu.revealTarget(option);
  }

  protected optionId(fieldId: string): string {
    return `${this.prefix()}-option-${fieldId}`;
  }

  private toggleField(fieldId: string): void {
    const selected = new Set(this.selectedFieldIds());
    if (!selected.delete(fieldId)) selected.add(fieldId);
    this.selectedFieldIds.set(selected);
  }
}
