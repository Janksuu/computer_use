import { focusWindow } from "../win32/window.js";

export async function handleFocusWindow(
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const windowId = args.window_id as string | undefined;
  if (!windowId) {
    return {
      content: [{ type: "text", text: "Error: window_id is required" }],
    };
  }

  const ok = focusWindow(windowId);
  return {
    content: [
      {
        type: "text",
        text: ok
          ? `Focused window ${windowId}`
          : `Failed to focus window ${windowId} (may be elevated or invalid)`,
      },
    ],
  };
}
