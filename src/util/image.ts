import sharp from "sharp";
import { config } from "../config.js";
import { getScaleInfo, type ScaleInfo } from "./scale.js";

export interface ProcessedScreenshot {
  base64: string;
  mimeType: "image/jpeg";
  scale: ScaleInfo;
}

/**
 * Convert a raw BGRA pixel buffer from BitBlt/GetDIBits into a scaled,
 * JPEG-encoded, base64 string suitable for MCP image content blocks.
 *
 * BitBlt with a top-down DIB (negative biHeight) produces BGRA byte order.
 * sharp expects raw RGBA, so we swap B and R channels in-place.
 */
export async function processScreenshot(
  rawBgra: Buffer,
  width: number,
  height: number
): Promise<ProcessedScreenshot> {
  // Swap BGRA -> RGBA in-place
  for (let i = 0; i < rawBgra.length; i += 4) {
    const b = rawBgra[i];
    rawBgra[i] = rawBgra[i + 2];   // R
    rawBgra[i + 2] = b;             // B
  }

  const scale = getScaleInfo(width, height);

  const jpegBuf = await sharp(rawBgra, {
    raw: { width, height, channels: 4 },
  })
    .resize(scale.scaledWidth, scale.scaledHeight)
    .jpeg({ quality: config.screenshot.jpegQuality })
    .toBuffer();

  return {
    base64: jpegBuf.toString("base64"),
    mimeType: "image/jpeg",
    scale,
  };
}
