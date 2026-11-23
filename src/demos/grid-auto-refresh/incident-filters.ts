import { KbqFilter, KbqPipe, KbqPipeTemplate, KbqPipeTypes } from '@koobiq/components/filter-bar';
import { ASSIGNEES, IncidentQuery, STATUS_LABELS, SEVERITY_LABELS } from './incident-model';

const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, name]) => ({ name, value, id: value }));
export const FILTER_TEMPLATES: KbqPipeTemplate[] = [
    { id: 'period', name: 'Период', values: options({ all: 'Всё время', hour: 'Последний час', day: 'Последние сутки' }), removable: false, cleanable: false },
    { id: 'status', name: 'Статус', values: options(STATUS_LABELS), removable: true },
    { id: 'severity', name: 'Критичность', values: options(SEVERITY_LABELS), removable: true },
    { id: 'assignee', name: 'Ответственный', values: ASSIGNEES.map(name => ({ name, value: name, id: name })), removable: true }
].map(template => ({ type: KbqPipeTypes.Select, cleanable: true, disabled: false, ...template }));

export function filterFromQuery(query: IncidentQuery): KbqFilter {
    const pipes: KbqPipe[] = [{ id: 'search', name: 'Поиск', type: KbqPipeTypes.Input, value: query.search || null, cleanable: true, removable: false, disabled: false }];
    for (const template of FILTER_TEMPLATES) {
        const value = query[template.id as 'period' | 'status' | 'severity' | 'assignee'];
        if (value === null) continue;
        const { values, ...pipe } = template;
        pipes.push({ ...pipe, value: values?.find(option => String((option as { value: unknown }).value) === String(value)) ?? null });
    }
    return { name: '', pipes, readonly: false, disabled: false, changed: false, saved: false };
}

export function queryFromFilter(filter: KbqFilter, sort: IncidentQuery['sort']): IncidentQuery {
    const value = (id: string): unknown => {
        const raw = filter.pipes.find(pipe => pipe.id === id)?.value;
        return raw && typeof raw === 'object' && 'value' in raw ? raw.value : raw;
    };
    return {
        search: String(value('search') ?? ''), status: (value('status') ?? null) as IncidentQuery['status'],
        severity: value('severity') ? Number(value('severity')) as IncidentQuery['severity'] : null,
        assignee: (value('assignee') ?? null) as string | null,
        period: (value('period') ?? 'all') as IncidentQuery['period'], sort
    };
}
