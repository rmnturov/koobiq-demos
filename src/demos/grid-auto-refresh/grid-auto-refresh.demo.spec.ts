import { describe, expect, it, vi } from 'vitest';
import { findDemo } from '../demos.registry';
import { filterFromQuery, queryFromFilter, IncidentFilters } from './incident-filters';
import { AutoRefreshController } from './auto-refresh-controller';
import { IncidentServer } from './incident-server';
import { DEFAULT_QUERY } from './incident-model';

describe('incident grid integration', () => {
  it('is available from the demo catalog', () => {
    expect(findDemo('grid-auto-refresh')).toBeDefined();
    expect(findDemo('grid-auto-refresh')!.loadComponent).toBeTypeOf('function');
  });
  it('round trips active filter values without losing sorting', () => {
    const query = {
      ...DEFAULT_QUERY,
      search: 'vpn',
      status: 'new' as const,
      severity: 2 as const,
      assignee: 'Анна Петрова',
      period: 'hour' as const,
    };
    expect(queryFromFilter(filterFromQuery(query), query.sort)).toEqual(query);
  });
  it('removing optional pipes removes their constraints', () => {
    const filter = filterFromQuery({ ...DEFAULT_QUERY, status: 'closed' });
    filter.pipes = filter.pipes.filter((pipe) => pipe.id !== 'status');
    expect(queryFromFilter(filter, DEFAULT_QUERY.sort).status).toBeNull();
  });
});

describe('filter request coordination', () => {
  it('clearing a search before its response prevents a stale grid beneath an empty field', async () => {
    const rows = new IncidentServer().initialRows;
    let resolve!: (data: readonly import('./incident-model').Incident[]) => void;
    const source = {
      initialRows: rows,
      catchUp() {},
      read: vi
        .fn()
        .mockImplementationOnce(() => new Promise((done) => (resolve = done)))
        .mockResolvedValue(rows),
    };
    const state = new AutoRefreshController(source);
    const filters = new IncidentFilters(state);
    const first = filters.change(filterFromQuery({ ...DEFAULT_QUERY, search: 'vpn' }));
    const second = filters.change(filterFromQuery(DEFAULT_QUERY));
    resolve(rows);
    await Promise.all([first, second]);
    expect(state.query().search).toBe('');
    expect(queryFromFilter(filters.filter(), DEFAULT_QUERY.sort).search).toBe('');
    expect(state.snapshot()).toHaveLength(300);
  });
  it('keeps a newly added empty pipe open without requesting unchanged data', async () => {
    const rows = new IncidentServer().initialRows;
    const source = { initialRows: rows, catchUp() {}, read: vi.fn().mockResolvedValue(rows) };
    const filters = new IncidentFilters(new AutoRefreshController(source));
    const next = filterFromQuery(DEFAULT_QUERY);
    next.pipes.push({
      id: 'status',
      name: 'Статус',
      type: 'select',
      value: null,
      removable: true,
      cleanable: true,
      disabled: false,
    });
    await filters.change(next);
    expect(filters.filter().pipes.some((pipe) => pipe.id === 'status')).toBe(true);
    expect(source.read).not.toHaveBeenCalled();
  });
});
