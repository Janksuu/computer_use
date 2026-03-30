import { config } from "../config.js";

/**
 * Simple token-bucket rate limiter.
 * Tokens refill continuously at maxActionsPerSecond.
 * Resets on server restart (in-memory only).
 */
let tokens: number = config.security.maxActionsPerSecond;
let lastRefill: number = Date.now();

export function checkRateLimit(): string | null {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  const maxRate = config.security.maxActionsPerSecond;

  // Refill tokens
  tokens = Math.min(maxRate, tokens + elapsed * maxRate);
  lastRefill = now;

  if (tokens < 1) {
    return `Rate limit exceeded: max ${maxRate} actions/sec. Try again shortly.`;
  }

  tokens -= 1;
  return null;
}
