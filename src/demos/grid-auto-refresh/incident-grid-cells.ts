import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { KbqBadgeModule } from '@koobiq/components/badge';
import { SEVERITY_LABELS } from './incident-model';
import { KbqLinkModule } from '@koobiq/components/link';
import { AutoRefreshController } from './auto-refresh-controller';
import { Incident } from './incident-model';

export interface IncidentGridContext {
  controller: AutoRefreshController;
}

@Component({
  selector: 'incident-id-cell',
  imports: [KbqLinkModule],
  template: `<a kbqLink pseudo underline="always" (click)="open()">{{ row?.id }}</a>`,
})
export class IncidentIdCell implements ICellRendererAngularComp {
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
