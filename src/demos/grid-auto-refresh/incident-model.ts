export type IncidentStatus = 'new' | 'investigating' | 'closed';
export type IncidentSeverity = 1 | 2 | 3 | 4;

export interface Incident {
  readonly id: string;
  readonly createdAt: number;
  readonly name: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly source: string;
  readonly assignee: string;
  readonly tags: readonly string[];
  readonly description: string;
}

export type IncidentSortField = 'createdAt' | 'name' | 'id' | 'severity' | 'status' | 'source';
export interface IncidentQuery {
  readonly search: string;
  readonly status: IncidentStatus | null;
  readonly severity: IncidentSeverity | null;
  readonly assignee: string | null;
  readonly period: 'all' | 'hour' | 'day';
  readonly sort: { readonly field: IncidentSortField; readonly direction: 'asc' | 'desc' };
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  new: 'Новый',
  investigating: 'В работе',
  closed: 'Закрыт',
};
export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  1: 'Низкая',
  2: 'Средняя',
  3: 'Высокая',
  4: 'Критическая',
};
export const ASSIGNEES = ['Не назначен', 'Иван Иванов', 'Анна Петрова', 'Алексей Смирнов'];
export const DEFAULT_QUERY: IncidentQuery = {
  search: '',
  status: null,
  severity: null,
  assignee: null,
  period: 'all',
  sort: { field: 'createdAt', direction: 'desc' },
};

const NAMES = [
  'Подбор пароля к учетной записи',
  'Сканирование портов внутренней сети',
  'Подозрительный запуск PowerShell',
  'Вход из новой страны',
  'Обнаружен вредоносный файл',
  'Попытка повышения привилегий',
  'Подключение к внешнему узлу',
  'Изменена политика безопасности',
  'Множественные ошибки авторизации',
  'Обнаружена фишинговая ссылка',
  'Передача большого объема данных',
  'Создана новая учетная запись',
];
const SOURCES = [
  'vpn.example.com',
  'web-01.example.com',
  'ws-042.example.com',
  'mail.example.com',
  'fs-01.example.com',
];

export function createIncident(sequence: number, createdAt: number): Incident {
  return {
    id: `INC-${String(10000 + sequence)}`,
    createdAt,
    name: NAMES[sequence % NAMES.length],
    severity: ((sequence % 4) + 1) as IncidentSeverity,
    status: (['new', 'investigating', 'closed'] as const)[sequence % 3],
    source: SOURCES[sequence % SOURCES.length],
    assignee: ASSIGNEES[Math.floor(sequence / 3) % ASSIGNEES.length],
    tags: sequence % 2 ? ['Авторизация', 'VPN', 'Active'] : ['Malware', 'EDR', 'Windows'],
    description:
      sequence % 2
        ? 'Зафиксирована серия неуспешных попыток входа в учетную запись. Проверьте журнал авторизации и сопоставьте события с другими инцидентами на этом узле.'
        : 'Событие сопоставлено с правилом корреляции. Проверьте процесс, источник соединения и активность пользователя за последний час.',
  };
}

export function queryIncidents(
  rows: readonly Incident[],
  query: IncidentQuery,
  now: number,
): Incident[] {
  const text = query.search.trim().toLocaleLowerCase('ru');
  const since =
    query.period === 'hour' ? now - 3600000 : query.period === 'day' ? now - 86400000 : -Infinity;
  return rows
    .filter(
      (row) =>
        (!query.status || row.status === query.status) &&
        (!query.severity || row.severity === query.severity) &&
        (!query.assignee || row.assignee === query.assignee) &&
        row.createdAt >= since &&
        (!text || `${row.id} ${row.name} ${row.source}`.toLocaleLowerCase('ru').includes(text)),
    )
    .sort((a, b) => {
      const left = a[query.sort.field],
        right = b[query.sort.field];
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), 'ru', { numeric: true });
      return (
        (order || a.id.localeCompare(b.id, 'ru', { numeric: true })) *
        (query.sort.direction === 'desc' ? -1 : 1)
      );
    });
}

export function recordCount(count: number): string {
  const mod10 = count % 10,
    mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} новая запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} новые записи`;
  return `${count} новых записей`;
}
