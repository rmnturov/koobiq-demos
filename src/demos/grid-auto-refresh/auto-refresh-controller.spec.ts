import { vi } from 'vitest';
import { AutoRefreshController } from './auto-refresh-controller';
import { createIncident, DEFAULT_QUERY, Incident } from './incident-model';
import { IncidentServer } from './incident-server';

describe('auto-refresh controller', () => {
  const origin = Date.UTC(2026, 10, 23, 7);
  function setup() {
    let time = origin;
    let rows: readonly Incident[] = new IncidentServer({ now: () => time }).initialRows;
    const source = { initialRows: rows, catchUp: vi.fn(), read: vi.fn(async () => rows) };
    const controller = new AutoRefreshController(source, { now: () => time });
    return {
      controller,
      source,
      advance: (ms: number) => {
        time += ms;
      },
      append: (count = 3) => {
        rows = [
          ...rows,
          ...Array.from({ length: count }, (_, i) => createIncident(rows.length + i + 1, time + i)),
        ];
      },
    };
  }

  afterEach(() => vi.useRealTimers());

  it('starts with 50 of 300 rows and safely applies new rows at the top', async () => {
    const { controller: c, append } = setup();
    expect(c.visibleRows()).toHaveLength(50);
    expect(c.snapshot()).toHaveLength(300);
    expect(c.newlyAppliedIds()).toEqual([]);
    append();
    await c.poll();
    expect(c.snapshot()).toHaveLength(303);
    expect(c.visibleRows()[0].createdAt).toBe(origin + 2);
    expect(c.pendingCount()).toBe(0);
    expect(c.newlyAppliedIds()).toHaveLength(3);
    expect(c.newlyAppliedIds()).toContain(c.visibleRows()[0].id);
  });

  it('latches protection after scrolling and deduplicates repeated discoveries', async () => {
    const { controller: c, append } = setup();
    const previous = c.visibleRows();
    const previousIds = new Set(c.snapshot().map((row) => row.id));
    c.protect('Прокрутка таблицы');
    append();
    await c.poll();
    await c.poll();
    expect(c.protectedMode()).toBe(true);
    expect(c.visibleRows()).toBe(previous);
    expect(c.pendingCount()).toBe(3);
    c.loadMore();
    expect(c.visibleRows()).toHaveLength(100);
    expect(c.visibleRows().every((row) => previousIds.has(row.id))).toBe(true);
  });

  it('marks only newly applied rows in the first block and never flashes subsequent loading', async () => {
    const { controller: c, append } = setup();
    c.protect('Прокрутка таблицы');
    append(80);
    await c.poll();
    expect(c.newlyAppliedIds()).toEqual([]);
    await c.refresh();
    expect(c.newlyAppliedIds()).toHaveLength(50);
    expect(c.newlyAppliedIds()).toEqual(c.visibleRows().map((row) => row.id));
    c.loadMore();
    expect(c.newlyAppliedIds()).toHaveLength(50);
    await c.refresh();
    expect(c.newlyAppliedIds()).toEqual([]);
  });

  it('dismisses only the current notice, preserving pending data until more records arrive', async () => {
    const { controller: c, append } = setup();
    c.protect('Прокрутка таблицы');
    c.exactCount.set(false);
    const snapshot = c.snapshot();
    append();
    await c.poll();
    expect(c.pendingNoticeVisible()).toBe(true);
    c.dismissPendingNotice();
    expect(c.pendingNoticeVisible()).toBe(false);
    expect(c.pendingCount()).toBe(3);
    expect(c.snapshot()).toBe(snapshot);
    await c.poll();
    expect(c.pendingNoticeVisible()).toBe(false);
    append(1);
    await c.poll();
    expect(c.pendingNoticeVisible()).toBe(true);
    expect(c.pendingCount()).toBe(4);
  });

  it('allows a fresh notice after applying a previously dismissed batch', async () => {
    const { controller: c, append } = setup();
    c.protect('Прокрутка таблицы');
    append();
    await c.poll();
    c.dismissPendingNotice();
    await c.refresh();
    expect(c.pendingNoticeVisible()).toBe(false);
    c.protect('Прокрутка таблицы');
    append(1);
    await c.poll();
    expect(c.pendingCount()).toBe(1);
    expect(c.pendingNoticeVisible()).toBe(true);
  });

  it('only counts new records matching active filters', async () => {
    const { controller: c, append } = setup();
    await c.setQuery({ ...DEFAULT_QUERY, status: 'new' });
    c.protect('Прокрутка таблицы');
    append(12);
    await c.poll();
    expect(c.pendingCount()).toBe(4);
  });

  it('agrees the notice caption with the current count as new incidents accumulate', async () => {
    const { controller: c, append } = setup();
    c.protect('Прокрутка таблицы');
    let previous = 0;
    const captions: [number, string][] = [
      [1, '1 новая запись'],
      [2, '2 новые записи'],
      [4, '4 новые записи'],
      [5, '5 новых записей'],
      [11, '11 новых записей'],
      [12, '12 новых записей'],
      [14, '14 новых записей'],
      [21, '21 новая запись'],
      [22, '22 новые записи'],
      [24, '24 новые записи'],
      [25, '25 новых записей'],
      [101, '101 новая запись'],
      [111, '111 новых записей'],
      [112, '112 новых записей'],
      [121, '121 новая запись'],
      [122, '122 новые записи'],
      [125, '125 новых записей'],
    ];
    for (const [count, caption] of captions) {
      append(count - previous);
      await c.poll();
      expect(c.pendingText()).toBe(caption);
      previous = count;
    }
  });

  it('explicit refresh resets protection and pending records when there are no blockers', async () => {
    const { controller: c, append } = setup();
    c.protect('Прокрутка таблицы');
    append();
    await c.poll();
    await c.refresh();
    expect(c.pendingCount()).toBe(0);
    expect(c.protectedMode()).toBe(false);
    expect(c.visibleRows()).toHaveLength(50);
    expect(c.snapshot()).toHaveLength(303);
  });

  it('restores the entire selection and retains the open card after refresh', async () => {
    const { controller: c, append } = setup();
    const ids = c
      .visibleRows()
      .slice(0, 2)
      .map((row) => row.id);
    const card = c.visibleRows()[4];
    c.setSelection(ids);
    c.openCard(card);
    append();
    await c.poll();
    await c.refresh();
    expect(c.selectedIds()).toEqual(ids);
    expect(c.card()).toBe(card);
    expect(c.protectedMode()).toBe(true);
    c.setSelection([]);
    c.closeCard();
    expect(c.protectedMode()).toBe(true);
  });

  it('clears all selected IDs when any selected record is outside the first reloaded block', async () => {
    const { controller: c, append } = setup();
    c.loadMore();
    c.setSelection([c.visibleRows()[0].id, c.visibleRows()[70].id]);
    append();
    await c.refresh();
    expect(c.selectedIds()).toEqual([]);
    expect(c.protectedMode()).toBe(false);
  });

  it('keeps arbitrary sorting protected even after Show', async () => {
    const { controller: c, append } = setup();
    await c.setQuery({ ...DEFAULT_QUERY, sort: { field: 'severity', direction: 'asc' } });
    expect(c.protectedMode()).toBe(true);
    append();
    await c.poll();
    await c.refresh();
    append();
    await c.poll();
    expect(c.pendingCount()).toBe(3);
  });

  it('failed manual refresh preserves data, pending count, selection and card', async () => {
    const { controller: c, source, append } = setup();
    c.openCard(c.visibleRows()[0]);
    c.setSelection([c.visibleRows()[1].id]);
    append();
    await c.poll();
    const previous = c.snapshot(),
      selected = c.selectedIds(),
      card = c.card();
    source.read.mockRejectedValue(new Error('offline'));
    expect(await c.refresh()).toBe(false);
    expect(c.snapshot()).toBe(previous);
    expect(c.pendingCount()).toBe(3);
    expect(c.selectedIds()).toBe(selected);
    expect(c.card()).toBe(card);
    expect(c.error()).toBeTruthy();
  });

  it('only commits a changed query after successful loading', async () => {
    const { controller: c, source, append } = setup();
    c.protect('Прокрутка таблицы');
    append();
    await c.poll();
    source.read.mockRejectedValueOnce(new Error('offline'));
    expect(await c.setQuery({ ...DEFAULT_QUERY, status: 'closed' })).toBe(false);
    expect(c.query()).toEqual(DEFAULT_QUERY);
    expect(c.pendingCount()).toBe(3);
    await c.setQuery({ ...DEFAULT_QUERY, status: 'closed' });
    expect(c.snapshot().every((row) => row.status === 'closed')).toBe(true);
    expect(c.pendingCount()).toBe(0);
  });

  it('turning checks off and on preserves discovered records and protection', async () => {
    const { controller: c, source, append } = setup();
    c.protect('Прокрутка таблицы');
    append();
    await c.poll();
    const calls = source.read.mock.calls.length;
    c.setInterval(0);
    append();
    await c.poll();
    expect(source.read).toHaveBeenCalledTimes(calls);
    expect(c.pendingCount()).toBe(3);
    c.setInterval(5000);
    expect(c.pendingCount()).toBe(3);
    expect(c.protectedMode()).toBe(true);
    await c.poll();
    expect(c.pendingCount()).toBe(6);
  });

  it('pauses hidden checks and checks once on return without dropping the previous mode', async () => {
    const { controller: c, source, append } = setup();
    c.protect('Прокрутка таблицы');
    await c.setVisibility(true);
    append();
    await c.poll();
    expect(source.read).not.toHaveBeenCalled();
    await c.setVisibility(false);
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(c.pendingCount()).toBe(3);
    c.setInterval(0);
    await c.setVisibility(true);
    await c.setVisibility(false);
    expect(source.read).toHaveBeenCalledTimes(1);
  });

  it('backs off after errors and restores the selected interval after success', async () => {
    const { controller: c, source, advance } = setup();
    source.read
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'));
    await c.poll();
    expect(c.failedAttempts()).toBe(1);
    expect(c.retryDelayMs()).toBe(10000);
    expect(c.nextCheckAt()).toBe(origin + 10000);
    await c.poll();
    expect(c.failedAttempts()).toBe(2);
    expect(c.retryDelayMs()).toBe(20000);
    expect(c.nextCheckAt()).toBe(origin + 20000);
    advance(1000);
    await c.poll();
    expect(c.error()).toBeNull();
    expect(c.failedAttempts()).toBe(0);
    expect(c.retryDelayMs()).toBe(5000);
    expect(c.nextCheckAt()).toBe(origin + 6000);
  });

  it('caps automatic retries and keeps counting manual attempts while checks are off', async () => {
    const { controller: c, source } = setup();
    source.read.mockRejectedValue(new Error('offline'));
    for (let attempt = 1; attempt <= 8; attempt++) await c.refresh();
    expect(c.failedAttempts()).toBe(8);
    expect(c.retryDelayMs()).toBe(120000);
    c.setInterval(0);
    expect(c.retryDelayMs()).toBe(0);
    expect(c.nextCheckAt()).toBeNull();
    await c.refresh();
    expect(c.failedAttempts()).toBe(9);
    source.read.mockResolvedValue(source.initialRows);
    await c.refresh();
    expect(c.failedAttempts()).toBe(0);
    expect(c.error()).toBeNull();
    expect(c.nextCheckAt()).toBeNull();
  });

  it('ignores an older response and serializes the latest query', async () => {
    const { controller: c, source, append } = setup();
    let resolve!: (rows: readonly Incident[]) => void;
    source.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = c.poll();
    const change = c.setQuery({ ...DEFAULT_QUERY, status: 'closed' });
    expect(source.read).toHaveBeenCalledTimes(1);
    append();
    resolve(source.initialRows);
    await first;
    await change;
    expect(source.read).toHaveBeenCalledTimes(2);
    expect(c.query().status).toBe('closed');
    expect(c.snapshot()).toHaveLength(101);
  });

  it('coalesces concurrent polls and ignores responses after destroy', async () => {
    const { controller: c, source } = setup();
    let resolve!: (rows: readonly Incident[]) => void;
    source.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const snapshot = c.snapshot();
    const first = c.poll(),
      second = c.poll();
    expect(source.read).toHaveBeenCalledTimes(1);
    c.destroy();
    resolve([...source.initialRows, createIncident(301, origin + 1)]);
    await first;
    await second;
    expect(c.snapshot()).toBe(snapshot);
  });

  it('schedules checks at the chosen interval while generating with checks off', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(origin);
    const source = new IncidentServer({ now: Date.now, random: () => 0.6, latencyMs: 0 });
    const c = new AutoRefreshController(source, { now: Date.now });
    c.start();
    await vi.advanceTimersByTimeAsync(15000);
    expect(c.snapshot().length).toBeGreaterThan(300);
    c.setInterval(0);
    const applied = c.snapshot().length;
    await vi.advanceTimersByTimeAsync(15000);
    expect(c.snapshot()).toHaveLength(applied);
    expect(source.size).toBeGreaterThan(applied);
    c.destroy();
  });
});

it('does not insert a poll response after checks have been switched off', async () => {
  const rows = new IncidentServer().initialRows;
  let resolve!: (rows: readonly Incident[]) => void;
  const source = {
    initialRows: rows,
    catchUp() {},
    read: () => new Promise<readonly Incident[]>((done) => (resolve = done)),
  };
  const c = new AutoRefreshController(source);
  const pending = c.poll();
  c.setInterval(0);
  resolve([...rows, createIncident(301, Date.now() + 1)]);
  await pending;
  expect(c.snapshot()).toHaveLength(300);
  expect(c.pendingCount()).toBe(1);
});

it('retains discoveries without inserting when a pending poll resolves in a hidden tab', async () => {
  const rows = new IncidentServer().initialRows;
  let resolve!: (rows: readonly Incident[]) => void;
  const source = {
    initialRows: rows,
    catchUp() {},
    read: () => new Promise<readonly Incident[]>((done) => (resolve = done)),
  };
  const c = new AutoRefreshController(source);
  const pending = c.poll();
  await c.setVisibility(true);
  resolve([...rows, createIncident(301, Date.now() + 1)]);
  await pending;
  expect(c.snapshot()).toHaveLength(300);
  expect(c.pendingCount()).toBe(1);
});
