'use client';

import { useEffect, useState } from 'react';
import { DEMO_IDENTITIES } from '@/lib/demo-identities';

/**
 * Local FakeAuth only — mints a sealed HttpOnly session via /api/v1/auth/dev-session.
 * Must not render in production (parent pages gate on server; this also no-ops if API 404s).
 */
export function DevIdentitySwitcher({
  labels,
  onChange,
}: {
  labels: {
    signedInAs: string;
    notSignedIn: string;
    orgOwner: string;
    orgAgent: string;
    orgViewer?: string;
    platformAdmin: string;
    listingReviewer: string;
  };
  onChange?: (userId: string) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/v1/auth/session', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { userId?: string };
        if (data.userId) setUserId(data.userId);
      })
      .catch(() => undefined);
  }, []);

  async function pick(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/dev-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? 'session_failed');
        return;
      }
      setUserId(id);
      onChange?.(id);
    } catch {
      setError('session_failed');
    } finally {
      setBusy(false);
    }
  }

  const labelFor: Record<(typeof DEMO_IDENTITIES)[number]['labelKey'], string> = {
    orgOwner: labels.orgOwner,
    orgAgent: labels.orgAgent,
    orgViewer: labels.orgViewer ?? 'Org viewer',
    platformAdmin: labels.platformAdmin,
    listingReviewer: labels.listingReviewer,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        border: '1px dashed hsl(var(--border))',
        borderRadius: 'var(--radius)',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
      }}
      data-testid="dev-identity-switcher"
    >
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>
        {userId ? `${labels.signedInAs}: ${userId}` : labels.notSignedIn}
      </span>
      {DEMO_IDENTITIES.map((identity) => (
        <button
          key={identity.id}
          type="button"
          disabled={busy}
          onClick={() => void pick(identity.id)}
          data-testid={`dev-identity-${identity.labelKey}`}
          style={{
            fontSize: '0.8rem',
            padding: '0.25rem 0.6rem',
            borderRadius: 999,
            border: '1px solid hsl(var(--border))',
            background: userId === identity.id ? 'hsl(var(--primary))' : 'transparent',
            color: userId === identity.id ? 'hsl(var(--primary-foreground))' : 'inherit',
            cursor: 'pointer',
          }}
        >
          {labelFor[identity.labelKey]}
        </button>
      ))}
      {error ? <span style={{ color: 'crimson' }}>{error}</span> : null}
    </div>
  );
}
