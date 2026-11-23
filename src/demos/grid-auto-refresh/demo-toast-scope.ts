import { Overlay, OverlayContainer, OVERLAY_DEFAULT_CONFIG } from '@angular/cdk/overlay';
import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import {
  KbqToastPosition,
  KbqToastService,
  kbqToastConfigurationProvider,
} from '@koobiq/components/toast';

class DemoToastOverlayContainer extends OverlayContainer {
  constructor(private readonly host: HTMLElement) {
    super();
  }

  protected override _createContainer(): void {
    const container = this._document.createElement('div');
    container.classList.add('cdk-overlay-container', 'demo-toast-container');
    container.style.position = 'absolute';
    // The default container's platform bookkeeping belongs to the global container; keep this one independent.
    this.host.appendChild(container);
    this._containerElement = container;
  }
}

export function createDemoToastScope(host: HTMLElement, parent: EnvironmentInjector) {
  return createEnvironmentInjector(
    [
      { provide: OverlayContainer, useFactory: () => new DemoToastOverlayContainer(host) },
      Overlay,
      KbqToastService,
      // A top-layer popover would position against the browser viewport instead of the demo frame.
      { provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } },
      kbqToastConfigurationProvider({ position: KbqToastPosition.TOP_RIGHT }),
    ],
    parent,
    'Grid demo toasts',
  );
}
