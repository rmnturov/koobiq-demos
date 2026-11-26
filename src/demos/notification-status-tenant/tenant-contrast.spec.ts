import { themeLightnessContrast, themeWcagContrast } from './tenant-contrast';

describe('tenant letter APCA contrast', () => {
  it('matches APCA for the opaque theme counterparts at the selected indices', () => {
    expect(themeLightnessContrast('light', 16, 6)).toBeCloseTo(47.715686, 5);
    expect(themeLightnessContrast('dark', 15, 7)).toBeCloseTo(40.614055, 5);
    expect(themeLightnessContrast('light', 20, 2)).toBeCloseTo(89.409048, 5);
    expect(themeLightnessContrast('dark', 20, 3)).toBeCloseTo(87.44516, 5);
  });

  it('returns zero APCA when the opaque text and background steps match', () => {
    expect(themeLightnessContrast('light', 16, 16)).toBe(0);
    expect(themeLightnessContrast('dark', 15, 15)).toBe(0);
  });

  it('calculates WCAG ratios for the same opaque colors independently of APCA', () => {
    expect(themeWcagContrast('light', 16, 6)).toBeCloseTo(3.369042, 5);
    expect(themeWcagContrast('dark', 15, 7)).toBeCloseTo(3.919118, 5);
    expect(themeWcagContrast('light', 20, 2)).toBeCloseTo(11.604827, 5);
    expect(themeWcagContrast('dark', 20, 3)).toBeCloseTo(11.740641, 5);
    expect(themeWcagContrast('light', 16, 16)).toBeCloseTo(1, 5);
  });
});
