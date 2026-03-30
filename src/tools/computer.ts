import { captureScreen, captureRegion, getVirtualDesktop } from "../win32/display.js";
import {
  click,
  moveMouse,
  typeText,
  pressKey,
  scroll,
  drag,
  type ClickButton,
  type ScrollDirection,
} from "../win32/input.js";
import { getWindowBounds } from "../win32/window.js";
import { processScreenshot } from "../util/image.js";
import { scaledToScreen, getScaleInfo } from "../util/scale.js";

type ActionResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
};

function textResult(text: string): ActionResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(msg: string): ActionResult {
  return { content: [{ type: "text", text: `Error: ${msg}` }] };
}

// --- Coordinate context tracking ---
// The last screenshot determines the coordinate space for subsequent actions.
// A desktop screenshot maps coordinates against the full virtual desktop.
// A window screenshot maps coordinates against that window's rect.

interface CoordContext {
  scaleFactor: number;
  offsetX: number; // screen-space origin X of the captured region
  offsetY: number; // screen-space origin Y of the captured region
  scaledWidth: number;
  scaledHeight: number;
}

let lastContext: CoordContext | null = null;

function getDefaultContext(): CoordContext {
  const desktop = getVirtualDesktop();
  const scale = getScaleInfo(desktop.width, desktop.height);
  return {
    scaleFactor: scale.factor,
    offsetX: desktop.x,
    offsetY: desktop.y,
    scaledWidth: scale.scaledWidth,
    scaledHeight: scale.scaledHeight,
  };
}

function toScreen(x: number, y: number) {
  const ctx = lastContext ?? getDefaultContext();
  return scaledToScreen(x, y, ctx.scaleFactor, ctx.offsetX, ctx.offsetY);
}

export function getLastContext(): CoordContext | null {
  return lastContext;
}

export async function handleComputerAction(
  args: Record<string, unknown>
): Promise<ActionResult> {
  const action = args.action as string;

  if (!action) {
    return errorResult("Missing required field: action");
  }

  switch (action) {
    case "screenshot": {
      const windowId = args.window_id as string | undefined;
      let raw: { buffer: Buffer; width: number; height: number };
      let regionOffsetX = 0;
      let regionOffsetY = 0;

      if (windowId) {
        const bounds = getWindowBounds(windowId);
        if (!bounds) return errorResult(`Window not found: ${windowId}`);
        const w = bounds.right - bounds.left;
        const h = bounds.bottom - bounds.top;
        if (w <= 0 || h <= 0) return errorResult("Window has zero size");
        raw = captureRegion(bounds.left, bounds.top, w, h);
        regionOffsetX = bounds.left;
        regionOffsetY = bounds.top;
      } else {
        const desktop = getVirtualDesktop();
        raw = captureScreen();
        regionOffsetX = desktop.x;
        regionOffsetY = desktop.y;
      }

      const processed = await processScreenshot(raw.buffer, raw.width, raw.height);

      // Update coordinate context so subsequent actions map correctly
      lastContext = {
        scaleFactor: processed.scale.factor,
        offsetX: regionOffsetX,
        offsetY: regionOffsetY,
        scaledWidth: processed.scale.scaledWidth,
        scaledHeight: processed.scale.scaledHeight,
      };

      return {
        content: [
          {
            type: "image",
            data: processed.base64,
            mimeType: processed.mimeType,
          },
          {
            type: "text",
            text: `Screenshot: ${raw.width}x${raw.height} -> ${processed.scale.scaledWidth}x${processed.scale.scaledHeight} (scale ${processed.scale.factor.toFixed(4)})`,
          },
        ],
      };
    }

    case "click": {
      const coordinate = args.coordinate as [number, number] | undefined;
      if (!coordinate || coordinate.length !== 2) {
        return errorResult("click requires coordinate: [x, y]");
      }
      const { screenX, screenY } = toScreen(coordinate[0], coordinate[1]);
      const button = (args.button as ClickButton) ?? "left";
      const count = (args.count as number) ?? 1;
      click(screenX, screenY, button, count);
      return textResult(`Clicked ${button} at (${screenX}, ${screenY}) x${count}`);
    }

    case "move": {
      const coordinate = args.coordinate as [number, number] | undefined;
      if (!coordinate || coordinate.length !== 2) {
        return errorResult("move requires coordinate: [x, y]");
      }
      const { screenX, screenY } = toScreen(coordinate[0], coordinate[1]);
      moveMouse(screenX, screenY);
      return textResult(`Moved to (${screenX}, ${screenY})`);
    }

    case "type": {
      const text = args.text as string | undefined;
      if (!text) return errorResult("type requires text");
      typeText(text);
      return textResult(`Typed ${text.length} characters`);
    }

    case "key": {
      const key = args.key as string | undefined;
      if (!key) return errorResult("key requires key");
      pressKey(key);
      return textResult(`Pressed: ${key}`);
    }

    case "scroll": {
      const coordinate = args.coordinate as [number, number] | undefined;
      if (!coordinate || coordinate.length !== 2) {
        return errorResult("scroll requires coordinate: [x, y]");
      }
      const direction = args.direction as ScrollDirection | undefined;
      if (!direction) return errorResult("scroll requires direction");
      const { screenX, screenY } = toScreen(coordinate[0], coordinate[1]);
      const amount = (args.amount as number) ?? 3;
      scroll(screenX, screenY, direction, amount);
      return textResult(`Scrolled ${direction} by ${amount} at (${screenX}, ${screenY})`);
    }

    case "drag": {
      const from = args.from_coordinate as [number, number] | undefined;
      const to = args.to_coordinate as [number, number] | undefined;
      if (!from || !to || from.length !== 2 || to.length !== 2) {
        return errorResult("drag requires from_coordinate and to_coordinate: [x, y]");
      }
      const fromScreen = toScreen(from[0], from[1]);
      const toScreen_ = toScreen(to[0], to[1]);
      drag(fromScreen.screenX, fromScreen.screenY, toScreen_.screenX, toScreen_.screenY);
      return textResult(
        `Dragged (${fromScreen.screenX},${fromScreen.screenY}) -> (${toScreen_.screenX},${toScreen_.screenY})`
      );
    }

    default:
      return errorResult(
        `Unknown action: ${action}. Valid actions: screenshot, click, move, type, key, scroll, drag`
      );
  }
}
