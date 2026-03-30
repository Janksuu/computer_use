import koffi from "koffi";

// --- Constants ---

// GetSystemMetrics indices
export const SM_XVIRTUALSCREEN = 76;
export const SM_YVIRTUALSCREEN = 77;
export const SM_CXVIRTUALSCREEN = 78;
export const SM_CYVIRTUALSCREEN = 79;

// BitBlt raster ops
export const SRCCOPY = 0x00cc0020;

// DIB color table
export const DIB_RGB_COLORS = 0;

// Bitmap compression
export const BI_RGB = 0;

// SendInput types
export const INPUT_MOUSE = 0;
export const INPUT_KEYBOARD = 1;

// Mouse event flags
export const MOUSEEVENTF_MOVE = 0x0001;
export const MOUSEEVENTF_LEFTDOWN = 0x0002;
export const MOUSEEVENTF_LEFTUP = 0x0004;
export const MOUSEEVENTF_RIGHTDOWN = 0x0008;
export const MOUSEEVENTF_RIGHTUP = 0x0010;
export const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
export const MOUSEEVENTF_MIDDLEUP = 0x0040;
export const MOUSEEVENTF_WHEEL = 0x0800;
export const MOUSEEVENTF_HWHEEL = 0x1000;
export const MOUSEEVENTF_ABSOLUTE = 0x8000;
export const MOUSEEVENTF_VIRTUALDESK = 0x4000;

// Keyboard event flags
export const KEYEVENTF_KEYUP = 0x0002;
export const KEYEVENTF_UNICODE = 0x0004;

// Wheel delta
export const WHEEL_DELTA = 120;

// DPI awareness context
export const DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4;

// --- Struct definitions ---

export const RECT = koffi.struct("RECT", {
  left: "int32",
  top: "int32",
  right: "int32",
  bottom: "int32",
});

export const POINT = koffi.struct("POINT", {
  x: "int32",
  y: "int32",
});

export const BITMAPINFOHEADER = koffi.struct("BITMAPINFOHEADER", {
  biSize: "uint32",
  biWidth: "int32",
  biHeight: "int32",
  biPlanes: "uint16",
  biBitCount: "uint16",
  biCompression: "uint32",
  biSizeImage: "uint32",
  biXPelsPerMeter: "int32",
  biYPelsPerMeter: "int32",
  biClrUsed: "uint32",
  biClrImportant: "uint32",
});

// MOUSEINPUT for SendInput
export const MOUSEINPUT = koffi.struct("MOUSEINPUT", {
  dx: "int32",
  dy: "int32",
  mouseData: "uint32",
  dwFlags: "uint32",
  time: "uint32",
  dwExtraInfo: "uintptr",
});

// KEYBDINPUT for SendInput
export const KEYBDINPUT = koffi.struct("KEYBDINPUT", {
  wVk: "uint16",
  wScan: "uint16",
  dwFlags: "uint32",
  time: "uint32",
  dwExtraInfo: "uintptr",
});

// INPUT union -- koffi handles unions via struct with largest member
// We use separate mouse/keyboard input structs and pack them into a buffer
// that matches the C INPUT layout (type + union).
// INPUT size on x64: 4 (type) + 4 (padding) + 32 (union) = 40 bytes

export const INPUT_SIZE = 40; // sizeof(INPUT) on x64

// --- DLL bindings ---

const user32 = koffi.load("user32.dll");
const gdi32 = koffi.load("gdi32.dll");

// Display
export const GetSystemMetrics = user32.func("int GetSystemMetrics(int nIndex)");
export const GetDC = user32.func("intptr GetDC(intptr hWnd)");
export const ReleaseDC = user32.func("int ReleaseDC(intptr hWnd, intptr hDC)");

// DPI awareness
export const SetProcessDpiAwarenessContext = user32.func(
  "bool SetProcessDpiAwarenessContext(intptr value)"
);

// Cursor
export const SetCursorPos = user32.func("bool SetCursorPos(int X, int Y)");
export const GetCursorPos = user32.func("bool GetCursorPos(_Out_ POINT* lpPoint)");

// Input injection
export const SendInput_ = user32.func(
  "uint32 SendInput(uint32 cInputs, _In_ void* pInputs, int cbSize)"
);

// Window management
export const EnumWindows = user32.func(
  "bool EnumWindows(_In_ void* lpEnumFunc, intptr lParam)"
);
export const GetWindowTextW = user32.func(
  "int GetWindowTextW(intptr hWnd, _Out_ uint16* lpString, int nMaxCount)"
);
export const GetWindowTextLengthW = user32.func(
  "int GetWindowTextLengthW(intptr hWnd)"
);
export const IsWindowVisible = user32.func("bool IsWindowVisible(intptr hWnd)");
export const GetWindowRect = user32.func(
  "bool GetWindowRect(intptr hWnd, _Out_ RECT* lpRect)"
);
export const SetForegroundWindow = user32.func(
  "bool SetForegroundWindow(intptr hWnd)"
);
export const GetWindowThreadProcessId = user32.func(
  "uint32 GetWindowThreadProcessId(intptr hWnd, _Out_ uint32* lpdwProcessId)"
);

// GDI
export const CreateCompatibleDC = gdi32.func(
  "intptr CreateCompatibleDC(intptr hdc)"
);
export const CreateCompatibleBitmap = gdi32.func(
  "intptr CreateCompatibleBitmap(intptr hdc, int cx, int cy)"
);
export const SelectObject = gdi32.func(
  "intptr SelectObject(intptr hdc, intptr h)"
);
export const BitBlt = gdi32.func(
  "bool BitBlt(intptr hdc, int x, int y, int cx, int cy, intptr hdcSrc, int x1, int y1, uint32 rop)"
);
export const GetDIBits = gdi32.func(
  "int GetDIBits(intptr hdc, intptr hbm, uint32 start, uint32 cLines, _Out_ void* lpvBits, _Inout_ BITMAPINFOHEADER* lpbmi, uint32 usage)"
);
export const DeleteDC = gdi32.func("bool DeleteDC(intptr hdc)");
export const DeleteObject = gdi32.func("bool DeleteObject(intptr ho)");
