import { vi } from 'vitest';
import { createIncident, DEFAULT_QUERY, queryIncidents } from './incident-model';
import { IncidentServer } from './incident-server';

describe('incident server', () => {
  const origin = Date.UTC(2026, 10, 23, 7);

  afterEach(() => vi.useRealTimers());

  it('uses the registration date in IDs and initializes modification time at registration', () => {
    const registered = new Date(2026, 10, 24, 12).getTime();
    const incident = createIncident(1234, registered);
    expect(incident.id).toBe('INC-202611240-1234');
    expect(incident.updatedAt).toBe(registered);
    expect(createIncident(1, registered).id).toBe('INC-202611240-0001');
  });

  it('provides modification times within the lifetime of each incident and sorts by them', () => {
    const rows = new IncidentServer({ now: () => origin }).initialRows;
    expect(rows.every((row) => row.updatedAt >= row.createdAt && row.updatedAt <= origin)).toBe(
      true,
    );
    expect(rows.some((row) => row.updatedAt > row.createdAt)).toBe(true);
    const sorted = queryIncidents(
      rows,
      { ...DEFAULT_QUERY, sort: { field: 'updatedAt', direction: 'desc' } },
      origin,
    );
    expect(sorted.every((row, i) => i === 0 || sorted[i - 1].updatedAt >= row.updatedAt)).toBe(
      true,
    );
  });

  it('starts with 300 distinct incidents and filters without changing the source', () => {
    const server = new IncidentServer({ now: () => origin, random: () => 0 });
    const rows = server.initialRows;
    expect(rows).toHaveLength(300);
    expect(new Set(rows.map((row) => row.id)).size).toBe(300);
    const result = queryIncidents(rows, { ...DEFAULT_QUERY, status: 'new', severity: 4 }, origin);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((row) => row.status === 'new' && row.severity === 4)).toBe(true);
    expect(rows).toHaveLength(300);
    expect(queryIncidents(rows, DEFAULT_QUERY, origin)[0].createdAt).toBeGreaterThan(
      rows[0].createdAt,
    );
  });

  it('matches text and relative time alongside other filters', () => {
    const server = new IncidentServer({ now: () => origin });
    const row = server.initialRows.at(-1)!;
    const query = {
      ...DEFAULT_QUERY,
      search: row.id,
      period: 'hour' as const,
      assignee: row.assignee,
    };
    expect(queryIncidents(server.initialRows, query, origin).map((item) => item.id)).toEqual([
      row.id,
    ]);
    expect(
      queryIncidents(server.initialRows, { ...query, search: 'нет такого события' }, origin),
    ).toEqual([]);
  });

  it('allows quiet ticks but produces an arrival within 25 seconds', () => {
    let time = origin;
    const server = new IncidentServer({ now: () => time, random: () => 0 });
    time += 5000;
    server.catchUp();
    expect(server.size).toBe(300);
    time += 20000;
    server.catchUp();
    expect(server.size).toBeGreaterThan(300);
  });

  it('catches up elapsed time and assigns monotonically new IDs and creation times', async () => {
    let time = origin;
    const server = new IncidentServer({ now: () => time, random: () => 0.6, latencyMs: 0 });
    time += 60000;
    const rows = await server.read();
    expect(rows.length).toBeGreaterThan(310);
    const newRows = rows.slice(300);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(newRows.every((row) => row.createdAt > origin)).toBe(true);
    expect(newRows.at(-1)!.createdAt).toBeGreaterThan(newRows[0].createdAt);
  });

  it('supports large bursts independently of the ordinary small packets', () => {
    let time = origin;
    const server = new IncidentServer({ now: () => time, random: () => 0.999 });
    time += 5000;
    server.catchUp();
    expect(server.size - 300).toBeGreaterThanOrEqual(25);
  });

  it('keeps generating while connection requests fail', async () => {
    let time = origin;
    const server = new IncidentServer({ now: () => time, random: () => 0.6, latencyMs: 0 });
    server.offline = true;
    time += 15000;
    await expect(server.read()).rejects.toThrow('соединение');
    expect(server.size).toBeGreaterThan(300);
    server.offline = false;
    expect((await server.read()).length).toBe(server.size);
  });

  it('returns immutable request snapshots after simulated latency', async () => {
    vi.useFakeTimers();
    const server = new IncidentServer({ now: Date.now, random: () => 0.6, latencyMs: 200 });
    let completed = false;
    const response = server.read().then((rows) => {
      completed = true;
      return rows;
    });
    await vi.advanceTimersByTimeAsync(199);
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const rows = await response;
    const size = rows.length;
    await vi.advanceTimersByTimeAsync(10000);
    server.catchUp();
    expect(rows).toHaveLength(size);
    expect(server.size).toBeGreaterThan(size);
  });
});
