import { listWindows } from "../win32/window.js";

export async function handleListWindows(): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  const windows = listWindows();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(windows, null, 2),
      },
    ],
  };
}
