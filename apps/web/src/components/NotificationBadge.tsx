'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { hasSession } from '@/lib/guest-phase4b';

export function NotificationBadge({ locale, label }: { locale: string; label: string }) {
  const [unread, setUnread] = useState(0);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    const ok = await hasSession();
    setSignedIn(ok);
    if (!ok) {
      setUnread(0);
      return;
    }
    try {
      const res = await fetch('/api/v1/me/notifications', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as { unread?: number };
      setUnread(data.unread ?? 0);
    } catch {
      /* ignore badge errors */
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <Link
      href={`/${locale}/workspace/notifications`}
      aria-label={unread > 0 ? `${label} (${unread})` : label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
    >
      {label}
      {signedIn && unread > 0 ? (
        <span
          data-testid="unread-badge"
          style={{
            display: 'inline-flex',
            minWidth: '1.25rem',
            height: '1.25rem',
            padding: '0 0.35rem',
            borderRadius: '999px',
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground, 0 0% 100%))',
            fontSize: '0.75rem',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
