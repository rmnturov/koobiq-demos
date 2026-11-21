export type DrilldownCloseReason = 'escape' | 'action' | 'tab' | 'outside' | 'destroy';

export interface DrilldownFrame {
  id: string;
  opener?: HTMLElement;
  scrollTop: number;
  activeItemId: string | null;
}
import { InjectionToken } from '@angular/core';
import type { DrilldownMenu } from './drilldown-menu';

export const DRILLDOWN_MENU = new InjectionToken<DrilldownMenu>('DRILLDOWN_MENU');

