import { computed, signal } from '@angular/core';
import {
  DEFAULT_QUERY,
  Incident,
  IncidentQuery,
  queryIncidents,
  recordCount,
} from './incident-model';
import { IncidentSource } from './incident-server';

const BLOCK_SIZE = 50;
type RequestKind = 'poll' | 'refresh' | 'query';

export class AutoRefreshController {
  readonly newlyAppliedIds = signal<readonly string[]>([]);
  readonly snapshot = signal<readonly Incident[]>([]);
  readonly query = signal<IncidentQuery>(DEFAULT_QUERY);
  readonly selectedIds = signal<readonly string[]>([]);
  readonly card = signal<Incident | null>(null);
  readonly pendingCount = signal(0);
  readonly exactCount = signal(true);
  readonly intervalMs = signal(15000);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastChecked = signal<number | null>(null);
  readonly lastApplied = signal<number | null>(null);
  readonly nextCheckAt = signal<number | null>(null);
  readonly revision = signal(0);
  readonly currentTime = signal(0);
  private readonly visibleCount = signal(BLOCK_SIZE);
  private readonly interaction = signal<string | null>(null);
  private readonly hidden = signal(false);
  readonly visibleRows = computed(() => this.snapshot().slice(0, this.visibleCount()));
  readonly safeSort = computed(
    () => this.query().sort.field === 'createdAt' && this.query().sort.direction === 'desc',
  );
  readonly reasons = computed(() => {
    const reasons: string[] = [];
    if (this.card()) reasons.push('Открыта контент-панель');
    if (this.selectedIds().length) reasons.push('Есть выбранные строки');
    if (!this.safeSort())
      reasons.push('Выбрана сортировка, при которой записи могут оказаться в середине списка');
    if (this.interaction()) reasons.push(this.interaction()!);
    return reasons;
  });
  readonly protectedMode = computed(() => this.reasons().length > 0);
  readonly pendingText = computed(() =>
    this.exactCount() ? recordCount(this.pendingCount()) : 'Есть новые записи',
  );
  readonly secondsUntilCheck = computed(() => {
    const next = this.nextCheckAt();
    return next === null ? null : Math.max(0, Math.ceil((next - this.currentTime()) / 1000));
  });
  private appliedIds = new Set<string>();
  private requestId = 0;
  private inFlight: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private failures = 0;
  private destroyed = false;
  private readonly now: () => number;

  constructor(
    private readonly server: IncidentSource,
    options: { now?: () => number } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.currentTime.set(this.now());
    this.applySnapshot(server.initialRows, DEFAULT_QUERY);
    this.schedule();
  }

  start(): void {
    if (this.timer || this.destroyed) return;
    this.timer = setInterval(() => {
      this.currentTime.set(this.now());
      this.server.catchUp();
      const next = this.nextCheckAt();
      if (!this.hidden() && next !== null && this.now() >= next && !this.inFlight) void this.poll();
    }, 1000);
  }

  destroy(): void {
    this.destroyed = true;
    this.requestId++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  protect(reason: string): void {
    if (!this.interaction()) this.interaction.set(reason);
  }

  setSelection(ids: readonly string[]): void {
    if (ids.length || this.selectedIds().length) this.protect('Выбор строк');
    this.selectedIds.set([...ids]);
  }

  openCard(incident: Incident): void {
    this.card.set(incident);
    this.protect('Просмотр инцидента');
  }

  closeCard(): void {
    if (this.card()) this.protect('Просмотр инцидента');
    this.card.set(null);
  }

  loadMore(): void {
    this.visibleCount.update((count) => Math.min(count + BLOCK_SIZE, this.snapshot().length));
  }

  setInterval(ms: number): void {
    this.intervalMs.set(ms);
    this.schedule();
  }

  async setVisibility(hidden: boolean): Promise<boolean> {
    const wasHidden = this.hidden();
    this.hidden.set(hidden);
    if (!hidden && wasHidden) {
      this.server.catchUp();
      return this.poll();
    }
    return false;
  }

  poll(): Promise<boolean> {
    if (!this.intervalMs() || this.hidden() || this.destroyed) return Promise.resolve(false);
    if (this.inFlight) return this.inFlight;
    return this.request('poll', this.query());
  }

  refresh(): Promise<boolean> {
    return this.request('refresh', this.query());
  }

  setQuery(query: IncidentQuery): Promise<boolean> {
    this.protect('Изменение параметров выборки');
    return this.request('query', query);
  }

  private async request(kind: RequestKind, query: IncidentQuery): Promise<boolean> {
    if (this.destroyed) return false;
    const id = ++this.requestId;
    if (this.inFlight) await this.inFlight;
    if (id !== this.requestId || this.destroyed) return false;
    const work = this.execute(id, kind, query);
    this.inFlight = work;
    try {
      return await work;
    } finally {
      if (this.inFlight === work) this.inFlight = null;
    }
  }

  private async execute(id: number, kind: RequestKind, query: IncidentQuery): Promise<boolean> {
    this.busy.set(true);
    try {
      const rows = await this.server.read();
      if (id !== this.requestId || this.destroyed) return false;
      const now = this.now();
      this.currentTime.set(now);
      this.lastChecked.set(now);
      this.error.set(null);
      this.failures = 0;
      if (kind !== 'poll') {
        this.applySnapshot(rows, query);
      } else {
        const newRows = queryIncidents(rows, query, now).filter(
          (row) => !this.appliedIds.has(row.id),
        );
        if (newRows.length && this.intervalMs() && !this.hidden() && !this.protectedMode())
          this.applySnapshot(rows, query);
        else this.pendingCount.set(newRows.length);
      }
      this.schedule();
      return true;
    } catch {
      if (id !== this.requestId || this.destroyed) return false;
      this.error.set('Не удалось обновить данные');
      this.failures++;
      this.schedule();
      return false;
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }

  private applySnapshot(rows: readonly Incident[], query: IncidentQuery): void {
    const next = queryIncidents(rows, query, this.now());
    this.newlyAppliedIds.set(
      this.appliedIds.size
        ? next
            .slice(0, BLOCK_SIZE)
            .filter((row) => !this.appliedIds.has(row.id))
            .map((row) => row.id)
        : [],
    );
    const loadedIds = new Set(next.slice(0, BLOCK_SIZE).map((row) => row.id));
    const selection = this.selectedIds();
    if (!selection.every((id) => loadedIds.has(id))) this.selectedIds.set([]);
    this.appliedIds = new Set(rows.map((row) => row.id));
    this.query.set(query);
    this.snapshot.set(next);
    this.visibleCount.set(BLOCK_SIZE);
    this.pendingCount.set(0);
    this.interaction.set(null);
    this.lastApplied.set(this.now());
    this.revision.update((value) => value + 1);
  }

  private schedule(): void {
    const interval = this.intervalMs();
    this.nextCheckAt.set(
      interval ? this.now() + Math.min(interval * 2 ** this.failures, 120000) : null,
    );
  }
}
