import { vi } from 'vitest';
import { gridDemoSearch, readGridDemoSettings, writeGridDemoSettings } from './demo-url-settings';

describe('grid demo URL settings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    history.replaceState(null, '', '/');
  });

  it('round-trips a shared configuration, including Cyrillic, plus signs and filter values', () => {
    const settings = readGridDemoSettings('');
    Object.assign(settings, {
      intervalMs: 0,
      exactCount: false,
      noticeStyle: 'theme-fade-shadow',
      highlightStyle: 'solid-underline',
      highlightDurationMs: 3000,
      offline: true,
      theme: 'dark',
      scenario: 'card',
    });
    settings.query = {
      search: 'VPN + R&D = вход',
      status: 'investigating',
      severity: 4,
      assignee: 'Анна Петрова',
      period: 'hour',
      sort: { field: 'updatedAt', direction: 'asc' },
    };
    expect(readGridDemoSettings(gridDemoSearch(settings))).toEqual(settings);
  });

  it('rejects unsupported or malformed settings without breaking other valid settings', () => {
    const result = readGridDemoSettings(
      '?refresh=-1&count=false&notice=invalid&highlight=invalid&duration=Infinity&connection=yes&theme=nope&scenario=wrong&period=month&status=__proto__&severity=5&operator=unknown&sort=unknown&order=sideways&search=%ZZ',
      'dark',
    );
    expect(result).toEqual({
      ...readGridDemoSettings('', 'dark'),
      query: {
        ...readGridDemoSettings('').query,
        search: '%ZZ',
      },
    });
    expect(readGridDemoSettings('?refresh=&duration=').intervalMs).toBe(5000);
    expect(readGridDemoSettings('?refresh=0').intervalMs).toBe(0);
  });

  it('keeps existing theme preference until a shared link explicitly specifies a theme', () => {
    expect(readGridDemoSettings('', 'dark').theme).toBe('dark');
    expect(readGridDemoSettings('?theme=light', 'dark').theme).toBe('light');
  });

  it('removes cleared filters while preserving unrelated parameters', () => {
    const params = new URLSearchParams(
      gridDemoSearch(
        readGridDemoSettings(''),
        '?search=old&status=closed&severity=4&operator=old&utm_source=review',
      ),
    );
    expect(params.has('search')).toBe(false);
    expect(params.has('status')).toBe(false);
    expect(params.has('severity')).toBe(false);
    expect(params.has('operator')).toBe(false);
    expect(params.get('utm_source')).toBe('review');
  });

  it('replaces the URL without losing its path, fragment, router state or creating history entries', () => {
    history.replaceState(
      { navigationId: 42 },
      '',
      '/demo/grid-auto-refresh?utm_source=review#article',
    );
    const historyLength = history.length;
    const replace = vi.spyOn(history, 'replaceState');
    const settings = readGridDemoSettings('?notice=theme-fade-shadow&highlight=solid-underline');
    writeGridDemoSettings(settings, window);
    writeGridDemoSettings(settings, window);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(history.length).toBe(historyLength);
    expect(history.state).toEqual({ navigationId: 42 });
    expect(location.pathname).toBe('/demo/grid-auto-refresh');
    expect(location.hash).toBe('#article');
    expect(new URLSearchParams(location.search).get('utm_source')).toBe('review');
    expect(readGridDemoSettings(location.search)).toEqual(settings);
  });
});
