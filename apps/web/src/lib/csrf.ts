/**
 * Same-origin CSRF check for cookie-authenticated mutating requests.
 * GET remains safe under SameSite=Lax; mutations must originate from this deployment's origin.
 */
export function assertSameOrigin(request: Request): Response | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }

  const allowed = allowedOrigins(request);

  const origin = request.headers.get('origin');
  if (origin) {
    return allowed.has(origin) ? null : rejected();
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin) ? null : rejected();
    } catch {
      return rejected();
    }
  }

  // Neither header present: not a browser-initiated request (browsers always send Origin or
  // Referer on POST), so there is no ambient-credential CSRF vector to block here.
  return null;
}

function rejected(): Response {
  return Response.json({ error: 'csrf_origin_rejected' }, { status: 403 });
}

/**
 * The request's own host is authoritative: a cross-site attacker controls Origin/Referer but
 * never the Host of a request the browser sends to us. APP_ORIGIN is additionally honoured so
 * proxied deployments can accept their public origin when Host carries an internal name.
 */
function allowedOrigins(request: Request): Set<string> {
  const set = new Set<string>();

  const configured = process.env.APP_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      set.add(new URL(configured).origin);
    } catch {
      // ignore malformed configuration
    }
  }

  let requestProto = 'http';
  try {
    const url = new URL(request.url);
    requestProto = url.protocol.replace(':', '');
    set.add(url.origin);
  } catch {
    // ignore unparseable request URL
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? requestProto;
    set.add(`${proto}://${host}`);
  }

  return set;
}
