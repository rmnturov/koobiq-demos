export type DrilldownCloseReason = 'escape' | 'action' | 'tab' | 'outside' | 'destroy';

export interface DrilldownFrame {
  id: string;
  opener?: HTMLElement;
  scrollTop: number;
  activeItemId: string | null;
}
