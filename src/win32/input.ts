import {
  SendInput_,
  SetCursorPos,
  GetCursorPos,
  GetSystemMetrics,
  SM_CXVIRTUALSCREEN,
  SM_CYVIRTUALSCREEN,
  SM_XVIRTUALSCREEN,
  SM_YVIRTUALSCREEN,
  INPUT_SIZE,
  INPUT_MOUSE,
  INPUT_KEYBOARD,
  MOUSEEVENTF_MOVE,
  MOUSEEVENTF_LEFTDOWN,
  MOUSEEVENTF_LEFTUP,
  MOUSEEVENTF_RIGHTDOWN,
  MOUSEEVENTF_RIGHTUP,
  MOUSEEVENTF_MIDDLEDOWN,
  MOUSEEVENTF_MIDDLEUP,
  MOUSEEVENTF_WHEEL,
  MOUSEEVENTF_HWHEEL,
  MOUSEEVENTF_ABSOLUTE,
  MOUSEEVENTF_VIRTUALDESK,
  KEYEVENTF_KEYUP,
  KEYEVENTF_UNICODE,
  WHEEL_DELTA,
} from "./types.js";
import { initDpiAwareness } from "./display.js";

// --- Helpers for building INPUT structs in raw buffers ---

function makeMouseInput(
  dx: number,
  dy: number,
  mouseData: number,
  dwFlags: number
): Buffer {
  const buf = Buffer.alloc(INPUT_SIZE, 0);
  buf.writeUInt32LE(INPUT_MOUSE, 0); // type
  // union starts at offset 8 (4 type + 4 padding on x64)
  buf.writeInt32LE(dx, 8);       // dx
  buf.writeInt32LE(dy, 12);      // dy
  buf.writeUInt32LE(mouseData, 16); // mouseData
  buf.writeUInt32LE(dwFlags, 20);   // dwFlags
  buf.writeUInt32LE(0, 24);      // time
  // dwExtraInfo at 28, 8 bytes, leave as 0
  return buf;
}

function makeKeyInput(wVk: number, wScan: number, dwFlags: number): Buffer {
  const buf = Buffer.alloc(INPUT_SIZE, 0);
  buf.writeUInt32LE(INPUT_KEYBOARD, 0); // type
  // union starts at offset 8
  buf.writeUInt16LE(wVk, 8);       // wVk
  buf.writeUInt16LE(wScan, 10);    // wScan
  buf.writeUInt32LE(dwFlags, 12);  // dwFlags
  buf.writeUInt32LE(0, 16);        // time
  // dwExtraInfo at 20, 8 bytes, leave as 0
  return buf;
}

function sendInputs(inputs: Buffer[]): void {
  if (inputs.length === 0) return;
  const combined = Buffer.concat(inputs);
  const sent = SendInput_(inputs.length, combined, INPUT_SIZE);
  if (sent === 0) {
    throw new Error("SendInput failed: no inputs were sent");
  }
}

// Convert absolute screen coordinates to the 0-65535 normalized range
// that MOUSEEVENTF_ABSOLUTE expects, accounting for virtual desktop offset.
function toAbsolute(
  screenX: number,
  screenY: number
): { dx: number; dy: number } {
  initDpiAwareness();
  const vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
  const vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
  const vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
  const vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);

  const dx = Math.round(((screenX - vx) * 65535) / (vw - 1));
  const dy = Math.round(((screenY - vy) * 65535) / (vh - 1));
  return { dx, dy };
}

// --- Public API ---

export function moveMouse(x: number, y: number): void {
  const { dx, dy } = toAbsolute(x, y);
  sendInputs([
    makeMouseInput(dx, dy, 0, MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK),
  ]);
}

export type ClickButton = "left" | "right" | "middle";

export function mouseDown(button: ClickButton): void {
  const flag =
    button === "right"
      ? MOUSEEVENTF_RIGHTDOWN
      : button === "middle"
        ? MOUSEEVENTF_MIDDLEDOWN
        : MOUSEEVENTF_LEFTDOWN;
  sendInputs([makeMouseInput(0, 0, 0, flag)]);
}

export function mouseUp(button: ClickButton): void {
  const flag =
    button === "right"
      ? MOUSEEVENTF_RIGHTUP
      : button === "middle"
        ? MOUSEEVENTF_MIDDLEUP
        : MOUSEEVENTF_LEFTUP;
  sendInputs([makeMouseInput(0, 0, 0, flag)]);
}

export function click(
  x: number,
  y: number,
  button: ClickButton = "left",
  count: number = 1
): void {
  moveMouse(x, y);

  const downFlag =
    button === "right"
      ? MOUSEEVENTF_RIGHTDOWN
      : button === "middle"
        ? MOUSEEVENTF_MIDDLEDOWN
        : MOUSEEVENTF_LEFTDOWN;
  const upFlag =
    button === "right"
      ? MOUSEEVENTF_RIGHTUP
      : button === "middle"
        ? MOUSEEVENTF_MIDDLEUP
        : MOUSEEVENTF_LEFTUP;

  for (let i = 0; i < count; i++) {
    sendInputs([
      makeMouseInput(0, 0, 0, downFlag),
      makeMouseInput(0, 0, 0, upFlag),
    ]);
  }
}

export function drag(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): void {
  moveMouse(fromX, fromY);
  mouseDown("left");
  moveMouse(toX, toY);
  mouseUp("left");
}

export type ScrollDirection = "up" | "down" | "left" | "right";

export function scroll(
  x: number,
  y: number,
  direction: ScrollDirection,
  amount: number = 3
): void {
  moveMouse(x, y);

  const isHorizontal = direction === "left" || direction === "right";
  const flag = isHorizontal ? MOUSEEVENTF_HWHEEL : MOUSEEVENTF_WHEEL;
  const sign = direction === "down" || direction === "left" ? -1 : 1;
  const mouseData = sign * amount * WHEEL_DELTA;

  sendInputs([makeMouseInput(0, 0, mouseData >>> 0, flag)]);
}

// Virtual key code lookup for common key names
const VK_MAP: Record<string, number> = {
  backspace: 0x08, tab: 0x09, enter: 0x0d, return: 0x0d,
  shift: 0x10, ctrl: 0x11, control: 0x11, alt: 0x12, menu: 0x12,
  pause: 0x13, capslock: 0x14, escape: 0x1b, esc: 0x1b,
  space: 0x20, pageup: 0x21, pagedown: 0x22,
  end: 0x23, home: 0x24,
  left: 0x25, up: 0x26, right: 0x27, down: 0x28,
  insert: 0x2d, delete: 0x2e, del: 0x2e,
  win: 0x5b, super: 0x5b, lwin: 0x5b, rwin: 0x5c,
  f1: 0x70, f2: 0x71, f3: 0x72, f4: 0x73,
  f5: 0x74, f6: 0x75, f7: 0x76, f8: 0x77,
  f9: 0x78, f10: 0x79, f11: 0x7a, f12: 0x7b,
};

function resolveVk(key: string): number {
  const lower = key.toLowerCase();
  if (VK_MAP[lower] !== undefined) return VK_MAP[lower];
  // Single character -- use its uppercase char code as VK
  if (key.length === 1) {
    const code = key.toUpperCase().charCodeAt(0);
    if (code >= 0x30 && code <= 0x5a) return code; // 0-9, A-Z
  }
  throw new Error(`Unknown key: ${key}`);
}

export function pressKey(combo: string): void {
  // Parse combos like "ctrl+shift+s"
  const parts = combo.split("+").map((s) => s.trim());
  const modifiers = parts.slice(0, -1);
  const mainKey = parts[parts.length - 1];

  // Press modifiers down
  const downInputs: Buffer[] = [];
  for (const mod of modifiers) {
    downInputs.push(makeKeyInput(resolveVk(mod), 0, 0));
  }

  // Press main key down + up
  const vk = resolveVk(mainKey);
  downInputs.push(makeKeyInput(vk, 0, 0));
  downInputs.push(makeKeyInput(vk, 0, KEYEVENTF_KEYUP));

  // Release modifiers in reverse
  const upInputs: Buffer[] = [];
  for (const mod of modifiers.reverse()) {
    upInputs.push(makeKeyInput(resolveVk(mod), 0, KEYEVENTF_KEYUP));
  }

  sendInputs([...downInputs, ...upInputs]);
}

export function typeText(text: string): void {
  // Use UNICODE input for each character -- handles any character
  const inputs: Buffer[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    inputs.push(makeKeyInput(0, code, KEYEVENTF_UNICODE));
    inputs.push(makeKeyInput(0, code, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
  }
  sendInputs(inputs);
}

export function getCursorPosition(): { x: number; y: number } {
  const pt = { x: 0, y: 0 };
  GetCursorPos(pt);
  return pt;
}
