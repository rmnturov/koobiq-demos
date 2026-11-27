import type { KbqThemeMode } from '@koobiq/components/core';
import { ASSIGNEES, DEFAULT_QUERY, IncidentQuery, IncidentSortField } from './incident-model';

export const REFRESH_INTERVALS = [0, 5000, 15000, 30000, 60000];
export const NOTICE_STYLES = [
  { id: 'neutral', label: 'Белое' },
  { id: 'contrast-fade', label: 'Серое' },
  { id: 'theme', label: 'Синее' },
  { id: 'theme-fade', label: 'Светло-синее' },
  { id: 'theme-fade-shadow', label: 'Светло-синее с тенью' },
] as const;
export const HIGHLIGHT_STYLES = [
  { id: 'solid', label: 'Сплошная заливка' },
  { id: 'solid-underline', label: 'Заливка с подчеркиванием' },
  { id: 'gradient', label: 'Градиент' },
  { id: 'stripe', label: 'Полоса слева' },
  { id: 'outline', label: 'Рамка строки' },
  { id: 'underline', label: 'Подчеркивание' },
  { id: 'hatch', label: 'Штриховка' },
  { id: 'glow', label: 'Свечение' },
] as const;
export const HIGHLIGHT_DURATIONS = [
  { ms: 500, label: '0,5 с' },
  { ms: 1000, label: '1 с' },
  { ms: 2000, label: '2 с' },
  { ms: 3000, label: '3 с' },
];
export type DemoScenario = 'observe' | 'select' | 'card';
export interface GridDemoSettings {
  intervalMs: number;
  exactCount: boolean;
  noticeStyle: (typeof NOTICE_STYLES)[number]['id'];
  highlightStyle: (typeof HIGHLIGHT_STYLES)[number]['id'];
  highlightDurationMs: number;
  offline: boolean;
  theme: KbqThemeMode;
  scenario: DemoScenario;
  query: IncidentQuery;
}

function choice<T extends string | number>(
  value: string | null,
  values: readonly T[],
  fallback: T,
): T {
  return values.find((item) => String(item) === value) ?? fallback;
}

export function readGridDemoSettings(
  search: string,
  theme: KbqThemeMode = 'auto',
): GridDemoSettings {
  const p = new URLSearchParams(search);
  return {
    intervalMs: choice(p.get('refresh'), REFRESH_INTERVALS, 5000),
    exactCount: choice(p.get('count'), ['exact', 'unknown'], 'exact') === 'exact',
    noticeStyle: choice(
      p.get('notice'),
      NOTICE_STYLES.map(({ id }) => id),
      'neutral',
    ),
    highlightStyle: choice(
      p.get('highlight'),
      HIGHLIGHT_STYLES.map(({ id }) => id),
      'gradient',
    ),
    highlightDurationMs: choice(
      p.get('duration'),
      HIGHLIGHT_DURATIONS.map(({ ms }) => ms),
      2000,
    ),
    offline: choice(p.get('connection'), ['online', 'offline'], 'online') === 'offline',
    theme: choice(p.get('theme'), ['auto', 'light', 'dark'], theme),
    scenario: choice(p.get('scenario'), ['observe', 'select', 'card'], 'observe'),
    query: {
      search: p.get('search') ?? '',
      status: choice(p.get('status'), ['new', 'investigating', 'closed', ''] as const, '') || null,
      severity: choice(p.get('severity'), [1, 2, 3, 4, 0] as const, 0) || null,
      assignee: choice(p.get('operator'), ASSIGNEES, '') || null,
      period: choice(p.get('period'), ['all', 'hour', 'day'], 'all'),
      sort: {
        field: choice<IncidentSortField>(
          p.get('sort'),
          ['createdAt', 'updatedAt', 'name', 'id', 'severity', 'status', 'assignee', 'source'],
          DEFAULT_QUERY.sort.field,
        ),
        direction: choice(p.get('order'), ['asc', 'desc'], DEFAULT_QUERY.sort.direction),
      },
    },
  };
}

export function gridDemoSearch(settings: GridDemoSettings, search = ''): string {
  const p = new URLSearchParams(search);
  const values = {
    refresh: String(settings.intervalMs),
    count: settings.exactCount ? 'exact' : 'unknown',
    notice: settings.noticeStyle,
    highlight: settings.highlightStyle,
    duration: String(settings.highlightDurationMs),
    connection: settings.offline ? 'offline' : 'online',
    theme: settings.theme,
    scenario: settings.scenario,
    search: settings.query.search,
    period: settings.query.period,
    status: settings.query.status,
    severity: settings.query.severity === null ? null : String(settings.query.severity),
    operator: settings.query.assignee,
    sort: settings.query.sort.field,
    order: settings.query.sort.direction,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === '') p.delete(key);
    else p.set(key, value);
  }
  return p.toString();
}

export function writeGridDemoSettings(
  settings: GridDemoSettings,
  browser: Pick<Window, 'history' | 'location'>,
): void {
  const { pathname, search, hash } = browser.location;
  const next = `?${gridDemoSearch(settings, search)}`;
  if (next !== search)
    browser.history.replaceState(browser.history.state, '', `${pathname}${next}${hash}`);
}
