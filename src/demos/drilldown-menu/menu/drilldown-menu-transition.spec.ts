import { DrilldownTransition } from './drilldown-menu-transition';

describe('drilldown transitions', () => {
  it('sets the final geometry without waiting when motion is disabled', () => {
    const transition = new DrilldownTransition();
    const panel = document.createElement('div');
    const from = document.createElement('section');
    const to = document.createElement('section');
    const settled = vi.fn();
    transition.run({
      panel,
      from,
      to,
      direction: 'forward',
      targetWidth: 360,
      targetHeight: 240,
      disabled: true,
      settled,
    });
    expect(panel.style.width).toBe('360px');
    expect(panel.style.height).toBe('240px');
    expect(to.hidden).toBe(false);
    expect(from.hidden).toBe(true);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('reverses an unfinished transition without an obsolete cleanup hiding the target', () => {
    vi.useFakeTimers();
    const transition = new DrilldownTransition();
    const panel = document.createElement('div');
    const a = document.createElement('section');
    const b = document.createElement('section');
    b.hidden = true;
    const oldSettled = vi.fn();
    const settled = vi.fn();
    transition.run({
      panel,
      from: a,
      to: b,
      direction: 'forward',
      targetWidth: 320,
      targetHeight: 400,
      disabled: false,
      settled: oldSettled,
    });
    transition.run({
      panel,
      from: b,
      to: a,
      direction: 'back',
      targetWidth: 360,
      targetHeight: 240,
      disabled: false,
      settled,
    });
    vi.runAllTimers();
    expect(a.hidden).toBe(false);
    expect(b.hidden).toBe(true);
    expect(panel.style.width).toBe('360px');
    expect(oldSettled).not.toHaveBeenCalled();
    expect(settled).toHaveBeenCalledTimes(1);
    transition.destroy();
    vi.useRealTimers();
  });
});
