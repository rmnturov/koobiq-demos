import {
  SemanticTheme1,
  SemanticTheme2,
  SemanticTheme3,
  SemanticTheme4,
  SemanticTheme5,
  SemanticTheme6,
  SemanticTheme7,
  SemanticTheme8,
  SemanticTheme9,
  SemanticTheme10,
  SemanticTheme11,
  SemanticTheme12,
  SemanticTheme13,
  SemanticTheme14,
  SemanticTheme15,
  SemanticTheme16,
  SemanticTheme17,
  SemanticTheme18,
  SemanticTheme19,
  SemanticTheme20,
  SemanticDarkTheme1,
  SemanticDarkTheme2,
  SemanticDarkTheme3,
  SemanticDarkTheme4,
  SemanticDarkTheme5,
  SemanticDarkTheme6,
  SemanticDarkTheme7,
  SemanticDarkTheme8,
  SemanticDarkTheme9,
  SemanticDarkTheme10,
  SemanticDarkTheme11,
  SemanticDarkTheme12,
  SemanticDarkTheme13,
  SemanticDarkTheme14,
  SemanticDarkTheme15,
  SemanticDarkTheme16,
  SemanticDarkTheme17,
  SemanticDarkTheme18,
  SemanticDarkTheme19,
  SemanticDarkTheme20,
} from '@koobiq/design-tokens';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import Color from 'colorjs.io';

export type BadgeTheme = 'light' | 'dark';

// Numeric indices of Background/Theme-less aliases: theme-a2 and dark-theme-a3.
export const TENANT_BACKGROUND_MIN = { light: 2, dark: 3 } as const;

const THEME_PALETTES = {
  light: [
    SemanticTheme1,
    SemanticTheme2,
    SemanticTheme3,
    SemanticTheme4,
    SemanticTheme5,
    SemanticTheme6,
    SemanticTheme7,
    SemanticTheme8,
    SemanticTheme9,
    SemanticTheme10,
    SemanticTheme11,
    SemanticTheme12,
    SemanticTheme13,
    SemanticTheme14,
    SemanticTheme15,
    SemanticTheme16,
    SemanticTheme17,
    SemanticTheme18,
    SemanticTheme19,
    SemanticTheme20,
  ],
  dark: [
    SemanticDarkTheme1,
    SemanticDarkTheme2,
    SemanticDarkTheme3,
    SemanticDarkTheme4,
    SemanticDarkTheme5,
    SemanticDarkTheme6,
    SemanticDarkTheme7,
    SemanticDarkTheme8,
    SemanticDarkTheme9,
    SemanticDarkTheme10,
    SemanticDarkTheme11,
    SemanticDarkTheme12,
    SemanticDarkTheme13,
    SemanticDarkTheme14,
    SemanticDarkTheme15,
    SemanticDarkTheme16,
    SemanticDarkTheme17,
    SemanticDarkTheme18,
    SemanticDarkTheme19,
    SemanticDarkTheme20,
  ],
};

function srgb(css: string): [number, number, number] {
  const color = new Color(css).to('srgb').toGamut({ method: 'css' });
  const [r, g, b] = color.coords;
  return [(r ?? 0) * 255, (g ?? 0) * 255, (b ?? 0) * 255];
}

// Contrast uses opaque theme steps with the same indices as the rendered alpha backgrounds.
const THEME_COLORS = {
  light: THEME_PALETTES.light.map(srgb),
  dark: THEME_PALETTES.dark.map(srgb),
};

export function themeLightnessContrast(
  theme: BadgeTheme,
  foregroundStep: number,
  backgroundStep: number,
): number {
  const [r, g, b] = THEME_COLORS[theme][foregroundStep - 1];
  return Math.abs(
    Number(APCAcontrast(sRGBtoY([r, g, b]), sRGBtoY(THEME_COLORS[theme][backgroundStep - 1]))),
  );
}

export function themeWcagContrast(
  theme: BadgeTheme,
  foregroundStep: number,
  backgroundStep: number,
): number {
  const [r, g, b] = THEME_COLORS[theme][foregroundStep - 1];
  const [br, bg, bb] = THEME_COLORS[theme][backgroundStep - 1];
  const text = new Color('srgb', [r / 255, g / 255, b / 255]);
  const background = new Color('srgb', [br / 255, bg / 255, bb / 255]);
  return text.contrastWCAG21(background);
}
