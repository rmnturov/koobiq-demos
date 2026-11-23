import { createIncident, Incident } from './incident-model';

export interface IncidentSource {
    readonly initialRows: readonly Incident[];
    catchUp(): void;
    read(): Promise<readonly Incident[]>;
}

export class IncidentServer implements IncidentSource {
    readonly initialRows: readonly Incident[];
    offline = false;
    private rows: readonly Incident[];
    private nextTick: number;
    private lastArrival: number;
    private readonly now: () => number;
    private readonly random: () => number;
    private readonly latencyMs: number;

    constructor(options: { now?: () => number; random?: () => number; latencyMs?: number } = {}) {
        this.now = options.now ?? Date.now;
        this.random = options.random ?? Math.random;
        this.latencyMs = options.latencyMs ?? 450;
        const start = this.now();
        this.initialRows = Array.from({ length: 300 }, (_, i) => createIncident(i + 1, start - (300 - i) * 90000));
        this.rows = this.initialRows;
        this.lastArrival = start;
        this.nextTick = start + 5000;
    }

    get size(): number { return this.rows.length; }

    catchUp(): void {
        const now = this.now();
        const arrivals: Incident[] = [];
        while (this.nextTick <= now) {
            const draw = this.random();
            let count = draw < 0.35 ? 0 : draw < 0.85 ? 1 + Math.floor(this.random() * 4)
                : draw < 0.97 ? 5 + Math.floor(this.random() * 16) : 25 + Math.floor(this.random() * 56);
            if (!count && this.nextTick - this.lastArrival >= 25000) count = 1;
            if (count) {
                for (let i = 0; i < count; i++) {
                    arrivals.push(createIncident(this.rows.length + arrivals.length + 1, this.nextTick + i));
                }
                this.lastArrival = this.nextTick;
            }
            this.nextTick += 5000;
        }
        if (arrivals.length) this.rows = [...this.rows, ...arrivals];
    }

    async read(): Promise<readonly Incident[]> {
        if (this.latencyMs) await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
        this.catchUp();
        if (this.offline) throw new Error('Не удалось установить соединение');
        return this.rows;
    }
}
