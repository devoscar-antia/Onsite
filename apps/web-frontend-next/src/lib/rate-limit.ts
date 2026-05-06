import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createLimiter(requests: number, window: `${number} s` | `${number} m`) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Skip rate limiting if Upstash is not configured (dev without Redis)
  if (!url || !token) return null;

  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
  });
}

// Lazy singletons — created once per cold start
let loginLimiter: Ratelimit | null | undefined;
let registerLimiter: Ratelimit | null | undefined;

export async function checkLoginRateLimit(ip: string): Promise<{ ok: boolean; retryAfter?: number }> {
  if (loginLimiter === undefined) loginLimiter = createLimiter(10, "60 s");
  if (!loginLimiter) return { ok: true };

  const { success, reset } = await loginLimiter.limit(`login:${ip}`);
  return { ok: success, retryAfter: success ? undefined : Math.ceil((reset - Date.now()) / 1000) };
}

export async function checkRegisterRateLimit(ip: string): Promise<{ ok: boolean; retryAfter?: number }> {
  if (registerLimiter === undefined) registerLimiter = createLimiter(5, "60 s");
  if (!registerLimiter) return { ok: true };

  const { success, reset } = await registerLimiter.limit(`register:${ip}`);
  return { ok: success, retryAfter: success ? undefined : Math.ceil((reset - Date.now()) / 1000) };
}
