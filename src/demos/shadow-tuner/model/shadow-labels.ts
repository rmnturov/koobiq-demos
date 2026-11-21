import { Elevation, Geometry, Layer } from './shadow-model';

export const GEOMETRY_LABELS: Record<Geometry, string> = { x: 'X', y: 'Y', blur: 'Blur', spread: 'Spread' };
export const LAYER_LABELS: Record<Layer, string> = { outline: 'Outline', key: 'Key', ambient: 'Ambient' };
export const ELEVATION_LABELS: Record<Elevation, string> = { card: 'Card', popup: 'Popup', overlay: 'Overlay' };
