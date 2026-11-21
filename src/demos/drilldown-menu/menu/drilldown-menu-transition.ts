export interface DrilldownTransitionRequest {
  panel: HTMLElement;
  from: HTMLElement | null;
  to: HTMLElement;
  direction: 'forward' | 'back';
  targetWidth: number;
  targetHeight: number;
  disabled: boolean;
  settled: () => void;
  position?: () => void;
}

export class DrilldownTransition {
  private request?: DrilldownTransitionRequest;
  private readonly layers = new Set<HTMLElement>();
  private timer?: ReturnType<typeof setTimeout>;
  private frame?: number;
  private removeListener?: () => void;

  run(request: DrilldownTransitionRequest): void {
    this.cancelPending();
    this.request = request;
    const { panel, from, to, targetWidth, targetHeight, direction, disabled } = request;
    const sign = direction === 'forward' ? 1 : -1;
    const entering = !this.layers.has(to) || to.hidden;
    if (from) { this.layers.add(from); from.hidden = false; }
    this.layers.add(to);
    to.hidden = false;
    if (entering && from !== to && from && !disabled) {
      to.style.transition = 'none';
      to.style.transform = `translateX(${sign * targetWidth}px)`;
      void to.offsetWidth;
    }
    panel.style.transition = disabled ? 'none' : 'width 200ms var(--drilldown-easing), height 200ms var(--drilldown-easing)';
    panel.style.width = `${targetWidth}px`;
    panel.style.height = `${targetHeight}px`;
    for (const layer of this.layers) {
      layer.style.transition = disabled ? 'none' : 'transform 200ms var(--drilldown-easing)';
      layer.style.transform = layer === to ? 'translateX(0px)' : `translateX(${-sign * targetWidth}px)`;
    }
    if (disabled) { this.finish(); return; }
    const done = (event: TransitionEvent) => {
      if (event.target === to && event.propertyName === 'transform') this.finish();
    };
    to.addEventListener('transitionend', done);
    this.removeListener = () => to.removeEventListener('transitionend', done);
    this.timer = setTimeout(() => this.finish(), 250);
    if (request.position && typeof requestAnimationFrame !== 'undefined') {
      const position = () => {
        if (this.request !== request) return;
        request.position!();
        this.frame = requestAnimationFrame(position);
      };
      this.frame = requestAnimationFrame(position);
    }
  }

  finish(): void {
    const request = this.request;
    this.cancelPending();
    this.request = undefined;
    if (!request) return;
    for (const layer of this.layers) {
      layer.hidden = layer !== request.to;
      layer.style.transition = 'none';
      if (layer !== request.to) this.layers.delete(layer);
    }
    request.position?.();
    request.settled();
  }

  destroy(): void { this.cancelPending(); this.request = undefined; this.layers.clear(); }

  private cancelPending(): void {
    clearTimeout(this.timer);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.removeListener?.();
    this.removeListener = undefined;
    this.frame = undefined;
  }
}
