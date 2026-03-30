import path from "node:path";

export const config = {
  server: {
    name: "windows-computer-use",
    version: "0.1.0",
  },
  screenshot: {
    jpegQuality: 80,
    maxLongEdge: 1568,
    maxTotalPixels: 1_150_000,
  },
  security: {
    maxActionsPerSecond: 10,
    auditLogPath: path.join(process.cwd(), "audit.jsonl"),
  },
} as const;
