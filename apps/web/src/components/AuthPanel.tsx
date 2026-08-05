'use client';

import { useMemo, useState } from 'react';

type Labels = {
  emailOtp: string;
  mobileOtp: string;
  sendCode: string;
  verifyCode: string;
  codeSent: string;
  guestMerged: string;
};

export function AuthPanel({ locale, labels }: { locale: string; labels: Labels }) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [destination, setDestination] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guestKey = useMemo(() => {
    if (typeof window === 'undefined') return 'guest-ssr';
    const existing = window.localStorage.getItem('spain_guest_key');
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem('spain_guest_key', created);
    window.localStorage.setItem(
      'spain_guest_payload',
      JSON.stringify({
        favouriteListingIds: ['legacy-demo-1'],
        comparisonListingIds: [],
        recentViewListingIds: ['legacy-demo-1'],
        savedSearchCriteria: [{ locale }],
      }),
    );
    return created;
  }, [locale]);

  async function sendCode() {
    setError(null);
    setMessage(null);
    const res = await fetch('/api/v1/auth/otp/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel, destination, guestKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'request_failed');
      return;
    }
    setChallengeId(data.challengeId);
    setDevCode(data.devCode ?? null);
    setMessage(labels.codeSent);
  }

  async function verify() {
    setError(null);
    setMessage(null);
    const guestPayload = JSON.parse(
      window.localStorage.getItem('spain_guest_payload') ??
        '{"favouriteListingIds":[],"comparisonListingIds":[],"recentViewListingIds":[],"savedSearchCriteria":[]}',
    );
    const res = await fetch('/api/v1/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId, code, guestKey, guestPayload }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'verify_failed');
      return;
    }
    setMessage(
      data.merged
        ? `${labels.guestMerged} (user ${data.userId}; favourites ${data.merge.favouriteListingIds.length})`
        : `Signed in as ${data.userId}`,
    );
    document.cookie = `spain_user_id=${data.userId}; path=/; SameSite=Lax`;
    const guestFavs = JSON.parse(
      window.localStorage.getItem('spain_guest_favourites') ?? '[]',
    ) as string[];
    if (guestFavs.length) {
      await fetch('/api/v1/favourites', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-user-id': data.userId,
        },
        body: JSON.stringify({
          listingId: guestFavs[0],
          guestListingIds: guestFavs,
        }),
      });
    }
  }

  return (
    <div
      style={{
        marginTop: '1.5rem',
        display: 'grid',
        gap: '0.75rem',
        maxWidth: 420,
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: '1rem',
        background: 'hsl(var(--card))',
      }}
    >
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={() => setChannel('email')}>
          {labels.emailOtp}
        </button>
        <button type="button" onClick={() => setChannel('sms')}>
          {labels.mobileOtp}
        </button>
      </div>
      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder={channel === 'email' ? 'you@example.com' : '+34600000000'}
        style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid hsl(var(--border))' }}
      />
      <button type="button" onClick={sendCode}>
        {labels.sendCode}
      </button>
      {devCode ? (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>Dev code: {devCode}</p>
      ) : null}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="6-digit code"
        style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid hsl(var(--border))' }}
      />
      <button type="button" onClick={verify} disabled={!challengeId}>
        {labels.verifyCode}
      </button>
      {message ? <p style={{ color: 'hsl(var(--primary))' }}>{message}</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
    </div>
  );
}
