import { Component, signal } from '@angular/core';
import { ICellRendererAngularComp, IHeaderAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, IHeaderParams } from 'ag-grid-community';
import { KbqBadgeModule } from '@koobiq/components/badge';
import { SEVERITY_LABELS } from './incident-model';
import { KbqLinkModule } from '@koobiq/components/link';
import { AutoRefreshController } from './auto-refresh-controller';
import { Incident, IncidentSortField } from './incident-model';

export interface IncidentGridContext {
  controller: AutoRefreshController;
}

@Component({
  selector: 'incident-title-cell',
  imports: [KbqLinkModule],
  template: `<button kbqLink pseudo type="button" (click)="open()">{{ row?.name }}</button>`,
  styles: [
    `
      :host {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      button {
        background: none;
        border: 0;
        padding: 0;
        font: inherit;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
export class IncidentTitleCell implements ICellRendererAngularComp {
  row?: Incident;
  private context!: IncidentGridContext;
  agInit(params: ICellRendererParams<Incident, unknown, IncidentGridContext>): void {
    this.row = params.data;
    this.context = params.context;
  }
  refresh(params: ICellRendererParams<Incident, unknown, IncidentGridContext>): boolean {
    this.agInit(params);
    return true;
  }
  open(): void {
    if (this.row) this.context.controller.openCard(this.row);
  }
}

@Component({
  selector: 'incident-sort-header',
  template: `<button type="button" (click)="sort()">
    {{ label }}
    <span aria-hidden="true">{{
      direction() === 'desc' ? '↓' : direction() === 'asc' ? '↑' : ''
    }}</span>
  </button>`,
  styles: [
    `
      :host {
        width: 100%;
        height: 100%;
      }
      button {
        font: inherit;
        color: inherit;
        background: none;
        border: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        text-align: left;
        cursor: pointer;
      }
      button:focus-visible {
        outline: 2px solid var(--kbq-line-theme);
        outline-offset: -2px;
      }
      span {
        margin-left: 6px;
      }
    `,
  ],
})
export class IncidentSortHeader implements IHeaderAngularComp {
  label = '';
  readonly direction = signal('');
  private params!: IHeaderParams<Incident, IncidentGridContext>;
  agInit(params: IHeaderParams<Incident, IncidentGridContext>): void {
    this.params = params;
    this.refresh(params);
  }
  refresh(params: IHeaderParams<Incident, IncidentGridContext>): boolean {
    this.label = params.displayName;
    const sort = params.context.controller.query().sort;
    const active = sort.field === params.column.getColId();
    this.direction.set(active ? sort.direction : '');
    // AG Grid clears aria-sort for a non-sortable column after refreshing the custom header.
    // Restore it after that pass: sorting here is applied through a successful query, not a grid click.
    queueMicrotask(() => {
      if (!params.eGridHeader.isConnected) return;
      const current = params.context.controller.query().sort;
      params.eGridHeader.setAttribute(
        'aria-sort',
        current.field === params.column.getColId()
          ? current.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none',
      );
    });
    return true;
  }
  sort(): void {
    const controller = this.params.context.controller;
    const field = this.params.column.getColId() as IncidentSortField;
    const direction = this.direction() === 'desc' ? 'asc' : 'desc';
    void controller.setQuery({ ...controller.query(), sort: { field, direction } });
  }
}

@Component({
  selector: 'incident-severity-cell',
  imports: [KbqBadgeModule],
  template: `<kbq-badge
    [badgeColor]="severity === 4 ? 'fade-error' : severity === 3 ? 'fade-warning' : 'fade-contrast'"
    >{{ labels[severity] }}</kbq-badge
  >`,
})
export class IncidentSeverityCell implements ICellRendererAngularComp {
  readonly labels = SEVERITY_LABELS;
  severity: Incident['severity'] = 1;
  agInit(params: ICellRendererParams<Incident>): void {
    this.severity = params.data?.severity ?? 1;
  }
  refresh(params: ICellRendererParams<Incident>): boolean {
    this.agInit(params);
    return true;
  }
}
