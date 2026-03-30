import { config } from "../config.js";

export interface ScaleInfo {
  factor: number;
  scaledWidth: number;
  scaledHeight: number;
}

/**
 * Calculate the scale factor to meet Anthropic API image constraints.
 * Max 1568px on longest edge, max ~1.15 megapixels total.
 */
export function getScaleInfo(
  screenWidth: number,
  screenHeight: number
): ScaleInfo {
  const { maxLongEdge, maxTotalPixels } = config.screenshot;
  const longEdge = Math.max(screenWidth, screenHeight);
  const totalPixels = screenWidth * screenHeight;

  const longEdgeScale = maxLongEdge / longEdge;
  const totalPixelsScale = Math.sqrt(maxTotalPixels / totalPixels);

  const factor = Math.min(1.0, longEdgeScale, totalPixelsScale);
  const scaledWidth = Math.floor(screenWidth * factor);
  const scaledHeight = Math.floor(screenHeight * factor);

  return { factor, scaledWidth, scaledHeight };
}

/**
 * Convert coordinates from scaled (Claude) space to screen space.
 */
export function scaledToScreen(
  x: number,
  y: number,
  factor: number,
  offsetX: number = 0,
  offsetY: number = 0
): { screenX: number; screenY: number } {
  return {
    screenX: Math.round(x / factor) + offsetX,
    screenY: Math.round(y / factor) + offsetY,
  };
}

/**
 * Convert coordinates from screen space to scaled (Claude) space.
 */
export function screenToScaled(
  screenX: number,
  screenY: number,
  factor: number,
  offsetX: number = 0,
  offsetY: number = 0
): { x: number; y: number } {
  return {
    x: Math.round((screenX - offsetX) * factor),
    y: Math.round((screenY - offsetY) * factor),
  };
}
