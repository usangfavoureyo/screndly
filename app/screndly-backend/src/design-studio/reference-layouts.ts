export type ReferenceLayoutVariant =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right';

export interface ReferenceVariantLayout {
  variant: ReferenceLayoutVariant;
  canvasWidth: number;
  canvasHeight: number;
  textBox: { x: number; y: number; width: number; height: number };
  alignment: 'left' | 'center' | 'right';
  brandBox: { x: number; y: number; width: number; height: number };
  backgroundAnchor: 'top' | 'bottom' | 'left' | 'right' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  overlayDirection: 'top' | 'bottom' | 'left' | 'right';
  fadeDefaultEnabled: boolean;
  fadeDefaultOpacity: number;
  baseFontSize: number;
  minFontSize: number;
  maxFontSize: number;
  maxLines: number;
  lineHeightMultiplier: number;
  safeMargin: number;
}

export const REFERENCE_CANVAS_WIDTH = 1080;
export const REFERENCE_CANVAS_HEIGHT = 1350;
export const REFERENCE_BRAND_WIDTH = 341;
export const REFERENCE_BRAND_HEIGHT = 73;

export const REFERENCE_VARIANTS: Record<ReferenceLayoutVariant, ReferenceVariantLayout> = {
  bottom_center: {
    variant: 'bottom_center',
    canvasWidth: 1080,
    canvasHeight: 1350,
    textBox: { x: 88, y: 1042, width: 904, height: 260 },
    alignment: 'center',
    brandBox: { x: 369, y: 48, width: 341, height: 73 },
    backgroundAnchor: 'top',
    overlayDirection: 'bottom',
    fadeDefaultEnabled: true,
    fadeDefaultOpacity: 0.92,
    baseFontSize: 100,
    minFontSize: 62,
    maxFontSize: 100,
    maxLines: 4,
    lineHeightMultiplier: 0.93,
    safeMargin: 48,
  },
  bottom_left: {
    variant: 'bottom_left',
    canvasWidth: 1080,
    canvasHeight: 1350,
    textBox: { x: 49, y: 895, width: 510, height: 372 },
    alignment: 'left',
    brandBox: { x: 49, y: 49, width: 341, height: 73 },
    backgroundAnchor: 'top_right',
    overlayDirection: 'left',
    fadeDefaultEnabled: true,
    fadeDefaultOpacity: 0.9,
    baseFontSize: 88,
    minFontSize: 56,
    maxFontSize: 88,
    maxLines: 5,
    lineHeightMultiplier: 0.93,
    safeMargin: 49,
  },
  bottom_right: {
    variant: 'bottom_right',
    canvasWidth: 1080,
    canvasHeight: 1350,
    textBox: { x: 541, y: 844, width: 490, height: 423 },
    alignment: 'right',
    brandBox: { x: 688, y: 49, width: 341, height: 73 },
    backgroundAnchor: 'top_left',
    overlayDirection: 'right',
    fadeDefaultEnabled: true,
    fadeDefaultOpacity: 0.9,
    baseFontSize: 88,
    minFontSize: 56,
    maxFontSize: 88,
    maxLines: 5,
    lineHeightMultiplier: 0.93,
    safeMargin: 49,
  },
  top_center: {
    variant: 'top_center',
    canvasWidth: 1080,
    canvasHeight: 1350,
    textBox: { x: 108, y: 44, width: 864, height: 322 },
    alignment: 'center',
    brandBox: { x: 369, y: 1221, width: 341, height: 73 },
    backgroundAnchor: 'bottom',
    overlayDirection: 'top',
    fadeDefaultEnabled: false,
    fadeDefaultOpacity: 0.85,
    baseFontSize: 94,
    minFontSize: 60,
    maxFontSize: 94,
    maxLines: 4,
    lineHeightMultiplier: 0.92,
    safeMargin: 44,
  },
  top_left: {
    variant: 'top_left',
    canvasWidth: 1080,
    canvasHeight: 1350,
    textBox: { x: 46, y: 36, width: 495, height: 438 },
    alignment: 'left',
    brandBox: { x: 49, y: 1223, width: 341, height: 73 },
    backgroundAnchor: 'bottom_right',
    overlayDirection: 'left',
    fadeDefaultEnabled: false,
    fadeDefaultOpacity: 0.82,
    baseFontSize: 88,
    minFontSize: 56,
    maxFontSize: 88,
    maxLines: 5,
    lineHeightMultiplier: 0.92,
    safeMargin: 46,
  },
  top_right: {
    variant: 'top_right',
    canvasWidth: 1080,
    canvasHeight: 1350,
    textBox: { x: 548, y: 34, width: 486, height: 432 },
    alignment: 'right',
    brandBox: { x: 688, y: 1223, width: 341, height: 73 },
    backgroundAnchor: 'bottom_left',
    overlayDirection: 'right',
    fadeDefaultEnabled: false,
    fadeDefaultOpacity: 0.82,
    baseFontSize: 88,
    minFontSize: 56,
    maxFontSize: 88,
    maxLines: 5,
    lineHeightMultiplier: 0.92,
    safeMargin: 46,
  },
};
