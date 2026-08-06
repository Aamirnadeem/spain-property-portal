/** Simple in-memory sliding-window rate limiter for Phase 4C share routes. */

const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prior = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (prior.length >= limit) {
    buckets.set(key, prior);
    return false;
  }
  prior.push(now);
  buckets.set(key, prior);
  return true;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function classifyShareUa(ua: string | null): 'browser' | 'bot' | 'preview' | 'other' {
  if (!ua) return 'other';
  const lower = ua.toLowerCase();
  if (
    /facebookexternalhit|twitterbot|slackbot|linkedinbot|whatsapp|discordbot|telegrambot/.test(
      lower,
    )
  ) {
    return 'preview';
  }
  if (/bot|crawler|spider|curl|wget|python-requests/.test(lower)) return 'bot';
  return 'browser';
}
