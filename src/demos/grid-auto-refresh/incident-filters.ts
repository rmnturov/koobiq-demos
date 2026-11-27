import { signal } from '@angular/core';
import { AutoRefreshController } from './auto-refresh-controller';
import { KbqFilter, KbqPipe, KbqPipeTemplate, KbqPipeTypes } from '@koobiq/components/filter-bar';
import { ASSIGNEES, IncidentQuery, STATUS_LABELS, SEVERITY_LABELS } from './incident-model';

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, name]) => ({ name, value, id: value }));
export const FILTER_TEMPLATES: KbqPipeTemplate[] = [
  {
    id: 'period',
    name: 'Период',
    values: options({ all: 'Всё время', hour: 'Последний час', day: 'Последние сутки' }),
    removable: false,
    cleanable: false,
  },
  { id: 'status', name: 'Статус', values: options(STATUS_LABELS), removable: true },
  { id: 'severity', name: 'Критичность', values: options(SEVERITY_LABELS), removable: true },
  {
    id: 'assignee',
    name: 'Оператор',
    values: ASSIGNEES.map((name) => ({ name, value: name, id: name })),
    removable: true,
  },
].map((template) => ({ type: KbqPipeTypes.Select, cleanable: true, disabled: false, ...template }));

export function filterFromQuery(query: IncidentQuery): KbqFilter {
  const pipes: KbqPipe[] = [
    {
      id: 'search',
      name: 'Поиск',
      type: KbqPipeTypes.Input,
      value: query.search || null,
      cleanable: true,
      removable: false,
      disabled: false,
    },
  ];
  for (const template of FILTER_TEMPLATES) {
    const value = query[template.id as 'period' | 'status' | 'severity' | 'assignee'];
    if (value === null) continue;
    const { values, ...pipe } = template;
    pipes.push({
      ...pipe,
      value:
        values?.find((option) => String((option as { value: unknown }).value) === String(value)) ??
        null,
    });
  }
  return { name: '', pipes, readonly: false, disabled: false, changed: false, saved: false };
}

export function queryFromFilter(filter: KbqFilter, sort: IncidentQuery['sort']): IncidentQuery {
  const value = (id: string): unknown => {
    const raw = filter.pipes.find((pipe) => pipe.id === id)?.value;
    return raw && typeof raw === 'object' && 'value' in raw ? raw.value : raw;
  };
  return {
    search: String(value('search') ?? ''),
    status: (value('status') ?? null) as IncidentQuery['status'],
    severity: value('severity') ? (Number(value('severity')) as IncidentQuery['severity']) : null,
    assignee: (value('assignee') ?? null) as string | null,
    period: (value('period') ?? 'all') as IncidentQuery['period'],
    sort,
  };
}

export class IncidentFilters {
  readonly filter;
  private requestId = 0;
  private pending = false;

  constructor(private readonly state: AutoRefreshController) {
    this.filter = signal(filterFromQuery(state.query()));
  }

  restore(query: IncidentQuery): void {
    this.requestId++;
    this.pending = false;
    this.state.restoreQuery(query);
    this.filter.set(filterFromQuery(query));
  }

  async change(filter: KbqFilter | null): Promise<void> {
    if (!filter) return;
    const id = ++this.requestId;
    this.filter.set(filter);
    const query = queryFromFilter(filter, this.state.query().sort);
    if (!this.pending && JSON.stringify(query) === JSON.stringify(this.state.query())) return;
    this.pending = true;
    await this.state.setQuery(query);
    if (id === this.requestId) {
      this.pending = false;
      this.filter.set(filterFromQuery(this.state.query()));
    }
  }
}
