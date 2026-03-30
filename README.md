# Windows Computer Use

A Windows desktop-control backend for Claude Code, delivered as an MCP server.

Takes screenshots, clicks, types, scrolls, and manages windows on your Windows desktop -- giving Claude Code the same kind of computer interaction that Anthropic's first-party Computer Use provides on Mac.

## What this is

An MCP server that exposes three tools:

- **`computer`** -- Anthropic-compatible action model: `screenshot`, `click`, `move`, `type`, `key`, `scroll`, `drag`
- **`list_windows`** -- Enumerate visible windows with stable HWND-based IDs, PIDs, titles, and bounds
- **`focus_window`** -- Bring a window to the foreground by its window ID

Claude Code connects over stdio and uses these tools in a perception-action loop: screenshot the desktop, analyze what's on screen, take an action, screenshot again.

## What this is not

This is not a full clone of Anthropic's first-party Mac experience. It is:

- Local and installable via npm
- Standard-user only (cannot interact with elevated/admin windows)
- Subject to Windows focus and UAC limitations
- Desktop screenshot based (no occluded/minimized window capture)

For the target audience -- Windows users who want Claude Code to see and control their desktop -- this is still valuable.

## Install

```bash
cd /path/to/windows-computer-use
npm install
npm run build
```

No local C++ toolchain required. koffi and sharp ship prebuilt native binaries.

## Configure Claude Code

Add to your Claude Code `settings.json` (user or project scope):

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "node",
      "args": ["/path/to/windows-computer-use/build/index.js"]
    }
  }
}
```

Restart Claude Code. The tools will appear automatically.

## Tools

### `computer`

The primary tool. Dispatch actions via the `action` field:

| Action | Required Params | Description |
|--------|----------------|-------------|
| `screenshot` | -- | Capture the full virtual desktop as a scaled JPEG |
| `screenshot` | `window_id` | Capture a specific window's visible rect |
| `click` | `coordinate` | Click at [x, y] in scaled space |
| `move` | `coordinate` | Move cursor to [x, y] |
| `type` | `text` | Type a text string |
| `key` | `key` | Press a key combo (e.g., `ctrl+s`, `alt+f4`) |
| `scroll` | `coordinate`, `direction` | Scroll up/down/left/right |
| `drag` | `from_coordinate`, `to_coordinate` | Click-drag between points |

Optional params: `button` (left/right/middle), `count` (click count), `amount` (scroll notches).

Coordinates are in the scaled screenshot space. Take a screenshot first, then use coordinates from that image.

### `list_windows`

Returns JSON array:

```json
[
  {
    "window_id": "0x00030014",
    "pid": 19148,
    "title": "My App - Visual Studio Code",
    "bounds": { "left": -7, "top": -7, "right": 2568, "bottom": 1400 },
    "visible": true
  }
]
```

### `focus_window`

Bring a window to the foreground:

```json
{ "window_id": "0x00030014" }
```

May fail silently for elevated windows due to Windows UAC restrictions.

## Architecture

```
Claude Code (stdio) --> MCP Server --> koffi FFI --> Win32 APIs
                           |
                       sharp (resize + JPEG encode)
                           |
                       audit.jsonl (redacted)
```

- **Win32 FFI**: koffi calling user32.dll (SendInput, EnumWindows, SetForegroundWindow) and gdi32.dll (BitBlt, GetDIBits)
- **Image pipeline**: Raw BGRA pixels -> sharp resize to fit Anthropic's 1568px/1.15MP constraints -> JPEG quality 80 -> base64
- **DPI**: PER_MONITOR_AWARE_V2 set at startup
- **Coordinates**: Virtual desktop aware (multi-monitor from day one)

## Security

- **Bounds validation**: Coordinates outside the scaled virtual desktop are rejected
- **Rate limiting**: Token-bucket at 10 actions/second (configurable in config.ts)
- **Redacted audit log**: Every action logged to `audit.jsonl` with timestamp, tool name, action type, target window, and coordinates. Screenshot payloads and typed text are never logged.
- **Standard user**: Runs without elevation. Cannot interact with admin windows.
- **Localhost only**: stdio transport, no network exposure

## Known Limitations

- Screenshots use GDI BitBlt -- works for most content but may show black for some hardware-accelerated overlays
- Window screenshots are crops of the visible desktop, not private window captures. Occluded or minimized windows will show whatever is visually on top.
- Aggressive scaling on ultra-wide or multi-monitor setups (the API constraint is 1568px on the longest edge)
- No semantic element discovery (no UI Automation). All interaction is coordinate-based.
- HWND-based window_id values are stable within a session but not across restarts

## Dependencies

- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- MCP server protocol
- [koffi](https://www.npmjs.com/package/koffi) -- Win32 FFI bridge (no C++ toolchain needed)
- [sharp](https://www.npmjs.com/package/sharp) -- Image processing (resize, JPEG encode)

## License

MIT
