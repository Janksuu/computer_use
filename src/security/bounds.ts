import { getVirtualDesktop } from "../win32/display.js";
import { getScaleInfo } from "../util/scale.js";
import { getLastContext } from "../tools/computer.js";

/**
 * Validate that coordinates are within the current screenshot context bounds.
 * Uses the last screenshot's coordinate space if available, otherwise
 * falls back to the full virtual desktop.
 * Returns null if valid, or an error message if out of bounds.
 */
export function validateCoordinate(
  x: number,
  y: number
): string | null {
  const ctx = getLastContext();
  let maxW: number;
  let maxH: number;

  if (ctx) {
    maxW = ctx.scaledWidth;
    maxH = ctx.scaledHeight;
  } else {
    const desktop = getVirtualDesktop();
    const scale = getScaleInfo(desktop.width, desktop.height);
    maxW = scale.scaledWidth;
    maxH = scale.scaledHeight;
  }

  if (x < 0 || y < 0 || x >= maxW || y >= maxH) {
    return (
      `Coordinate (${x}, ${y}) out of bounds. ` +
      `Valid range: (0, 0) to (${maxW - 1}, ${maxH - 1})`
    );
  }
  return null;
}
