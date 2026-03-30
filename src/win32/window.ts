import koffi from "koffi";
import {
  EnumWindows,
  GetWindowTextW,
  GetWindowTextLengthW,
  IsWindowVisible,
  GetWindowRect,
  SetForegroundWindow,
  GetWindowThreadProcessId,
} from "./types.js";

export interface WindowInfo {
  window_id: string; // HWND as hex string (stable within session)
  pid: number;
  title: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  visible: boolean;
}

/**
 * Enumerate all visible, titled windows.
 * Returns HWND as hex string for stable identification.
 */
export function listWindows(): WindowInfo[] {
  const windows: WindowInfo[] = [];

  // koffi callback for EnumWindows
  const cb = koffi.register(
    (hwnd: number, _lParam: number): number => {
      if (!IsWindowVisible(hwnd)) return 1; // continue

      const titleLen = GetWindowTextLengthW(hwnd);
      if (titleLen === 0) return 1; // skip untitled

      // Read title as UTF-16
      const buf = Buffer.alloc((titleLen + 1) * 2);
      GetWindowTextW(hwnd, buf, titleLen + 1);
      const title = buf.toString("utf16le").replace(/\0+$/, "");

      if (!title) return 1;

      // Get bounds
      const rect = { left: 0, top: 0, right: 0, bottom: 0 };
      GetWindowRect(hwnd, rect);

      // Get PID
      const pidBuf = [0];
      GetWindowThreadProcessId(hwnd, pidBuf);

      windows.push({
        window_id: "0x" + (hwnd >>> 0).toString(16).padStart(8, "0"),
        pid: pidBuf[0],
        title,
        bounds: rect,
        visible: true,
      });

      return 1; // continue enumeration
    },
    koffi.pointer(
      koffi.proto("WNDENUMPROC", "int", ["intptr", "intptr"])
    )
  );

  try {
    EnumWindows(cb, 0);
  } finally {
    koffi.unregister(cb);
  }

  return windows;
}

/**
 * Parse a hex window_id string back to a numeric HWND.
 */
function parseHwnd(windowId: string): number {
  const num = parseInt(windowId, 16);
  if (isNaN(num) || num === 0) {
    throw new Error(`Invalid window_id: ${windowId}`);
  }
  return num;
}

/**
 * Bring a window to the foreground by its HWND-based window_id.
 */
export function focusWindow(windowId: string): boolean {
  const hwnd = parseHwnd(windowId);
  return SetForegroundWindow(hwnd);
}

/**
 * Get bounds of a specific window by its window_id.
 * Used for window-targeted screenshot (crop of desktop).
 */
export function getWindowBounds(
  windowId: string
): { left: number; top: number; right: number; bottom: number } | null {
  const hwnd = parseHwnd(windowId);
  const rect = { left: 0, top: 0, right: 0, bottom: 0 };
  const ok = GetWindowRect(hwnd, rect);
  if (!ok) return null;
  return rect;
}
