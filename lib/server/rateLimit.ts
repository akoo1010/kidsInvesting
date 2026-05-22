import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RATE_LIMIT } from "@/lib/constants";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const limiters = new Map<string, Ratelimit>();
function limiterFor(scope: string, limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${scope}:${limit}:${windowMs}`;
  let l = limiters.get(cacheKey);
  if (!l) {
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `wsc:rl:${scope}`,
    });
    limiters.set(cacheKey, l);
  }
  return l;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

const buckets = new Map<string, number[]>();

function inMemoryFallback(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    return { ok: false, retryAfterMs: list[0] + windowMs - now };
  }
  list.push(now);
  buckets.set(key, list);
  return { ok: true };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number = RATE_LIMIT.windowMs,
): Promise<RateLimitResult> {
  const scope = key.split(":")[0] ?? "default";
  const l = limiterFor(scope, limit, windowMs);
  if (!l) return inMemoryFallback(key, limit, windowMs);
  const r = await l.limit(key);
  if (r.success) return { ok: true };
  return { ok: false, retryAfterMs: r.reset - Date.now() };
}

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]?.trim() : "local";
  return `${scope}:${ip || "local"}`;
}
