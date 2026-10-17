/**
 * High-Performance Sliding Window Rate Limiter
 * 
 * Protects server actions and API routes against spam, brute force, and automated script attacks.
 * Uses an in-memory sliding window timestamp log with automatic garbage collection.
 */

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory store: Key -> Timestamp array
const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic garbage collection every 10 minutes to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  for (const [key, record] of rateLimitStore.entries()) {
    // Keep only timestamps within the longest expected window (e.g. 1 hour)
    const validTimestamps = record.timestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      record.timestamps = validTimestamps;
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetInSeconds: number;
  message?: string;
}

/**
 * Checks and consumes a rate limit token for a specific action and identifier.
 * 
 * @param key Unique identifier (e.g. `deposit:${userId}` or `ip:${ip}`)
 * @param limit Maximum allowed requests within the time window
 * @param windowSeconds Duration of the rate limit window in seconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  cleanupStaleEntries(windowMs);

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter out timestamps that have expired past the sliding window
  const windowStart = now - windowMs;
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= limit) {
    // Exceeded limit: calculate seconds until oldest timestamp in window expires
    const oldestTimestamp = record.timestamps[0];
    const resetInSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    return {
      success: false,
      remaining: 0,
      resetInSeconds: Math.max(1, resetInSeconds),
      message: `Too many requests. Please wait ${Math.max(1, resetInSeconds)} second(s) before trying again.`,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    success: true,
    remaining: limit - record.timestamps.length,
    resetInSeconds: windowSeconds,
  };
}
