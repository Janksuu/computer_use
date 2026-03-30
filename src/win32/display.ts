import {
  GetSystemMetrics,
  GetDC,
  ReleaseDC,
  CreateCompatibleDC,
  CreateCompatibleBitmap,
  SelectObject,
  BitBlt,
  GetDIBits,
  DeleteDC,
  DeleteObject,
  SetProcessDpiAwarenessContext,
  BITMAPINFOHEADER,
  SM_XVIRTUALSCREEN,
  SM_YVIRTUALSCREEN,
  SM_CXVIRTUALSCREEN,
  SM_CYVIRTUALSCREEN,
  SRCCOPY,
  BI_RGB,
  DIB_RGB_COLORS,
  DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
} from "./types.js";

export interface VirtualDesktop {
  x: number;
  y: number;
  width: number;
  height: number;
}

let dpiInitialized = false;

export function initDpiAwareness(): void {
  if (dpiInitialized) return;
  try {
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  } catch {
    // Falls back silently if already set or on older Windows
    process.stderr.write(
      "Warning: could not set PER_MONITOR_AWARE_V2 DPI awareness\n"
    );
  }
  dpiInitialized = true;
}

export function getVirtualDesktop(): VirtualDesktop {
  initDpiAwareness();
  return {
    x: GetSystemMetrics(SM_XVIRTUALSCREEN),
    y: GetSystemMetrics(SM_YVIRTUALSCREEN),
    width: GetSystemMetrics(SM_CXVIRTUALSCREEN),
    height: GetSystemMetrics(SM_CYVIRTUALSCREEN),
  };
}

export function captureScreen(): { buffer: Buffer; width: number; height: number } {
  initDpiAwareness();

  const desktop = getVirtualDesktop();
  const { x, y, width, height } = desktop;

  // Get screen DC
  const hdcScreen = GetDC(0);
  if (!hdcScreen) throw new Error("Failed to get screen DC");

  // Create memory DC and bitmap
  const hdcMem = CreateCompatibleDC(hdcScreen);
  const hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
  const hOld = SelectObject(hdcMem, hBitmap);

  try {
    // Copy screen to memory DC
    const ok = BitBlt(hdcMem, 0, 0, width, height, hdcScreen, x, y, SRCCOPY);
    if (!ok) throw new Error("BitBlt failed");

    // Prepare BITMAPINFOHEADER for GetDIBits
    const bmi = {
      biSize: 40,
      biWidth: width,
      biHeight: -height, // top-down
      biPlanes: 1,
      biBitCount: 32,
      biCompression: BI_RGB,
      biSizeImage: width * height * 4,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0,
    };

    // Read pixel data
    const pixelBuf = Buffer.alloc(width * height * 4);
    const lines = GetDIBits(
      hdcMem,
      hBitmap,
      0,
      height,
      pixelBuf,
      bmi,
      DIB_RGB_COLORS
    );
    if (lines === 0) throw new Error("GetDIBits returned 0 lines");

    return { buffer: pixelBuf, width, height };
  } finally {
    SelectObject(hdcMem, hOld);
    DeleteObject(hBitmap);
    DeleteDC(hdcMem);
    ReleaseDC(0, hdcScreen);
  }
}

export function captureRegion(
  rx: number,
  ry: number,
  rw: number,
  rh: number
): { buffer: Buffer; width: number; height: number } {
  initDpiAwareness();

  const hdcScreen = GetDC(0);
  if (!hdcScreen) throw new Error("Failed to get screen DC");

  const hdcMem = CreateCompatibleDC(hdcScreen);
  const hBitmap = CreateCompatibleBitmap(hdcScreen, rw, rh);
  const hOld = SelectObject(hdcMem, hBitmap);

  try {
    const ok = BitBlt(hdcMem, 0, 0, rw, rh, hdcScreen, rx, ry, SRCCOPY);
    if (!ok) throw new Error("BitBlt failed for region");

    const bmi = {
      biSize: 40,
      biWidth: rw,
      biHeight: -rh,
      biPlanes: 1,
      biBitCount: 32,
      biCompression: BI_RGB,
      biSizeImage: rw * rh * 4,
      biXPelsPerMeter: 0,
      biYPelsPerMeter: 0,
      biClrUsed: 0,
      biClrImportant: 0,
    };

    const pixelBuf = Buffer.alloc(rw * rh * 4);
    const lines = GetDIBits(hdcMem, hBitmap, 0, rh, pixelBuf, bmi, DIB_RGB_COLORS);
    if (lines === 0) throw new Error("GetDIBits returned 0 lines for region");

    return { buffer: pixelBuf, width: rw, height: rh };
  } finally {
    SelectObject(hdcMem, hOld);
    DeleteObject(hBitmap);
    DeleteDC(hdcMem);
    ReleaseDC(0, hdcScreen);
  }
}
