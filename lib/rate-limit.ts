// Simple in-memory rate limiter for Next.js API routes
// Uses a sliding window per IP address

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes to prevent memory bloat
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitOptions {
  /** Max requests in the window */
  limit: number
  /** Window duration in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

export function rateLimit(
  identifier: string,
  { limit, windowSeconds }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const key = identifier

  let entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // New window
    entry = { count: 1, resetAt: now + windowMs }
    store.set(key, entry)
    return { success: true, limit, remaining: limit - 1, resetAt: entry.resetAt }
  }

  entry.count++
  store.set(key, entry)

  const remaining = Math.max(0, limit - entry.count)
  return {
    success: entry.count <= limit,
    limit,
    remaining,
    resetAt: entry.resetAt,
  }
}

/**
 * Extract client IP from Next.js request
 */
export function getClientIp(req: Request): string {
  const headers = req instanceof Request ? req.headers : (req as any).headers
  return (
    (headers instanceof Headers
      ? headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      : (headers as any)['x-forwarded-for']?.split(',')[0]?.trim()) ??
    'unknown'
  )
}
