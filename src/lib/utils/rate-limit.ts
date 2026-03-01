interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function getClientIp(request: Request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export function checkRateLimit(args: { key: string; limit: number; windowMs: number }) {
  const now = Date.now();
  const current = buckets.get(args.key);

  if (!current || now >= current.resetAt) {
    buckets.set(args.key, { count: 1, resetAt: now + args.windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: args.limit - 1 };
  }

  if (current.count >= args.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      remaining: 0
    };
  }

  current.count += 1;
  buckets.set(args.key, current);
  return { allowed: true, retryAfterSec: 0, remaining: args.limit - current.count };
}

