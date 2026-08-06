import { NextResponse } from 'next/server';
import { resolvePublicComparisonShare } from '@spain/database';
import { getAppDb } from '@/lib/db';
import { checkRateLimit, classifyShareUa, clientIp } from '@/lib/rate-limit';

const securityHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

type Ctx = { params: Promise<{ token: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const ip = clientIp(request);
  if (!checkRateLimit(`share-resolve:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: securityHeaders });
  }

  const { token } = await ctx.params;
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: 'unavailable' }, { status: 404, headers: securityHeaders });
  }

  const { db, client } = getAppDb();
  try {
    const ua = classifyShareUa(request.headers.get('user-agent'));
    const result = await resolvePublicComparisonShare(db, token, { uaCategory: ua });
    if (result.status !== 'ok') {
      return NextResponse.json({ error: 'unavailable' }, { status: 404, headers: securityHeaders });
    }
    return NextResponse.json(result.dto, { headers: securityHeaders });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 404, headers: securityHeaders });
  } finally {
    await client.end({ timeout: 5 });
  }
}
