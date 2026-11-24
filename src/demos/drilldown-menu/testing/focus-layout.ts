/** jsdom does not lay out elements; CDK focusability needs nonzero visible geometry. */
export function installFocusLayout(): void {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.closest('[hidden],[inert]') || getComputedStyle(this).display === 'none' ? 0 : 20;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.offsetWidth;
    });
  });
  afterEach(() => vi.restoreAllMocks());
}
import { afterEach, beforeEach, vi } from 'vitest';
