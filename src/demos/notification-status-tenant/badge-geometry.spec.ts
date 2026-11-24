import {
  badgeGeometryStyles,
  DEFAULT_GEOMETRY,
  geometryControlMax,
  updateBadgeGeometry,
} from './badge-geometry';

describe('badge geometry', () => {
  it('stops native squircle radius sliders at full rounding', () => {
    expect(geometryControlMax('statusRadius', DEFAULT_GEOMETRY, true)).toBe(9);
    expect(geometryControlMax('tenantRadius', DEFAULT_GEOMETRY, true)).toBe(4);
    expect(geometryControlMax('statusRadius', DEFAULT_GEOMETRY, false)).toBe(16);
    expect(geometryControlMax('tenantRadius', DEFAULT_GEOMETRY, false)).toBe(7);
    expect(updateBadgeGeometry(DEFAULT_GEOMETRY, 'tenantRadius', 12, true).tenantRadius).toBe(4);
  });
  it('keeps the tenant and radii within their bounds when the status shrinks', () => {
    const large = {
      ...DEFAULT_GEOMETRY,
      statusSize: 80,
      tenantSize: 48,
      offset: 40,
      statusRadius: 35,
      tenantRadius: 24,
    };
    expect(updateBadgeGeometry(large, 'statusSize', 24)).toEqual({
      statusSize: 24,
      tenantSize: 24,
      offset: 24,
      gap: 2,
      statusRadius: 12,
      tenantRadius: 12,
    });
  });

  it('updates dimensions and the transparent cutout together', () => {
    const geometry = { ...DEFAULT_GEOMETRY, statusSize: 64, tenantSize: 32, offset: 12, gap: 4 };
    const styles = badgeGeometryStyles(geometry, true);
    expect(styles['--notification-status-size']).toBe('64px');
    expect(styles['--notification-tenant-size']).toBe('32px');
    const svg = decodeURIComponent(
      styles['--notification-status-mask'].match(/url\("data:image\/svg\+xml,(.*)"\)/)![1],
    );
    const root = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(root.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(root.querySelector('mask path')?.getAttribute('transform')).toBe('translate(44 44)');
    expect(root.querySelector('mask path')?.getAttribute('stroke-width')).toBe('8');
    expect(svg).not.toContain('NaN');
    expect(
      badgeGeometryStyles({ ...geometry, tenantRadius: 10 }, true)['--notification-status-mask'],
    ).not.toBe(styles['--notification-status-mask']);
    expect(badgeGeometryStyles(geometry, false)['--notification-status-mask']).not.toBe(
      styles['--notification-status-mask'],
    );
  });

  it('supports square corners, zero gap, and full overhang', () => {
    const geometry = {
      ...DEFAULT_GEOMETRY,
      tenantRadius: 0,
      gap: 0,
      offset: DEFAULT_GEOMETRY.tenantSize,
    };
    const styles = badgeGeometryStyles(geometry, true);
    const svg = decodeURIComponent(styles['--notification-status-mask']);
    expect(svg).toContain('translate(32 32)');
    expect(svg).toContain('stroke-width="0"');
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});
