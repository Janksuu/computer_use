import { appendFileSync } from "node:fs";
import { config } from "../config.js";

interface AuditEntry {
  timestamp: string;
  tool: string;
  action?: string;
  window_id?: string;
  coordinate?: [number, number];
  result: "ok" | "error" | "rate_limited" | "bounds_error";
  error_message?: string;
}

/**
 * Append a redacted audit entry to the JSONL log.
 * Never logs screenshot payloads or typed text content.
 */
export function logAudit(
  tool: string,
  args: Record<string, unknown>,
  result: AuditEntry["result"],
  errorMessage?: string
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    tool,
    result,
  };

  // Extract safe metadata only
  if (args.action) entry.action = String(args.action);
  if (args.window_id) entry.window_id = String(args.window_id);
  if (Array.isArray(args.coordinate)) {
    entry.coordinate = args.coordinate as [number, number];
  }
  if (errorMessage) entry.error_message = errorMessage;

  // Deliberately omit: text, key combos, screenshot data, from/to coordinates
  // Only log coordinate for single-point actions

  try {
    appendFileSync(
      config.security.auditLogPath,
      JSON.stringify(entry) + "\n",
      "utf-8"
    );
  } catch {
    // Audit write failure should not crash the server
    process.stderr.write("Warning: failed to write audit log entry\n");
  }
}
