import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleComputerAction } from "./computer.js";
import { handleListWindows } from "./list-windows.js";
import { handleFocusWindow } from "./focus-window.js";
import { checkRateLimit } from "../security/rate-limit.js";
import { validateCoordinate } from "../security/bounds.js";
import { logAudit } from "../security/audit.js";

const COMPUTER_TOOL: Tool = {
  name: "computer",
  description:
    "Control the Windows desktop: take screenshots, click, move the mouse, type text, press keys, scroll, and drag. " +
    "Coordinates are in the scaled screenshot space. Take a screenshot first to see the current state, then use coordinates from that image.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["screenshot", "click", "move", "type", "key", "scroll", "drag"],
        description: "The action to perform.",
      },
      coordinate: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "[x, y] in scaled screenshot space. Required for click, move, scroll.",
      },
      text: {
        type: "string",
        description: "Text to type (action=type) or key combo like 'ctrl+s' (action=key).",
      },
      key: {
        type: "string",
        description: "Key or key combo to press, e.g. 'enter', 'ctrl+shift+s'. For action=key.",
      },
      button: {
        type: "string",
        enum: ["left", "right", "middle"],
        description: "Mouse button for click action. Default: left.",
      },
      count: {
        type: "number",
        description: "Click count (1=single, 2=double, 3=triple). Default: 1.",
      },
      direction: {
        type: "string",
        enum: ["up", "down", "left", "right"],
        description: "Scroll direction. Required for action=scroll.",
      },
      amount: {
        type: "number",
        description: "Scroll amount in notches. Default: 3.",
      },
      from_coordinate: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "Drag start [x, y]. Required for action=drag.",
      },
      to_coordinate: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "Drag end [x, y]. Required for action=drag.",
      },
      window_id: {
        type: "string",
        description:
          "HWND hex string from list_windows. For action=screenshot, captures only that window's visible rect.",
      },
    },
    required: ["action"],
  },
};

const LIST_WINDOWS_TOOL: Tool = {
  name: "list_windows",
  description:
    "List all visible windows on the desktop. Returns window_id (stable HWND), pid, title, bounds, and visibility for each window. " +
    "Use window_id with focus_window or computer screenshot.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

const FOCUS_WINDOW_TOOL: Tool = {
  name: "focus_window",
  description:
    "Bring a window to the foreground by its window_id (HWND hex string from list_windows). " +
    "May fail for elevated (admin) windows due to Windows UAC restrictions.",
  inputSchema: {
    type: "object" as const,
    properties: {
      window_id: {
        type: "string",
        description: "HWND hex string from list_windows, e.g. '0x00030014'.",
      },
    },
    required: ["window_id"],
  },
};

const ALL_TOOLS: Tool[] = [COMPUTER_TOOL, LIST_WINDOWS_TOOL, FOCUS_WINDOW_TOOL];

const HANDLERS: Record<
  string,
  (args: Record<string, unknown>) => Promise<{ content: Array<Record<string, unknown>> }>
> = {
  computer: handleComputerAction,
  list_windows: () => handleListWindows(),
  focus_window: handleFocusWindow,
};

export function getToolDefinitions(): Tool[] {
  return ALL_TOOLS;
}

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<Record<string, unknown>> }> {
  const handler = HANDLERS[name];
  if (!handler) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}. Available: ${ALL_TOOLS.map((t) => t.name).join(", ")}`,
        },
      ],
    };
  }

  // Rate limit all actions except read-only list_windows
  if (name !== "list_windows") {
    const rlError = checkRateLimit();
    if (rlError) {
      logAudit(name, args, "rate_limited", rlError);
      return { content: [{ type: "text", text: `Error: ${rlError}` }] };
    }
  }

  // Bounds check for coordinate-bearing actions
  if (name === "computer") {
    const action = args.action as string;

    // Single-coordinate actions
    if (["click", "move", "scroll"].includes(action) && Array.isArray(args.coordinate)) {
      const [x, y] = args.coordinate as [number, number];
      const boundsError = validateCoordinate(x, y);
      if (boundsError) {
        logAudit(name, args, "bounds_error", boundsError);
        return { content: [{ type: "text", text: `Error: ${boundsError}` }] };
      }
    }

    // Drag: validate both endpoints
    if (action === "drag") {
      for (const field of ["from_coordinate", "to_coordinate"] as const) {
        const coord = args[field] as [number, number] | undefined;
        if (Array.isArray(coord) && coord.length === 2) {
          const boundsError = validateCoordinate(coord[0], coord[1]);
          if (boundsError) {
            logAudit(name, args, "bounds_error", `${field}: ${boundsError}`);
            return { content: [{ type: "text", text: `Error (${field}): ${boundsError}` }] };
          }
        }
      }
    }
  }

  try {
    const result = await handler(args);
    logAudit(name, args, "ok");
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logAudit(name, args, "error", msg);
    return { content: [{ type: "text", text: `Error: ${msg}` }] };
  }
}
