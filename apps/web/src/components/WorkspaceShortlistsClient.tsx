'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const GUEST_SHORTLISTS_KEY = 'spain_guest_shortlists';

type Shortlist = {
  id?: string;
  name: string;
  isDefault?: boolean;
  listingIds: string[];
  note?: string | null;
  itemCount?: number;
};

type Labels = Record<string, string>;

async function hasSession(): Promise<boolean> {
  const res = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
  if (!res.ok) return false;
  const data = (await res.json()) as { userId?: string | null };
  return Boolean(data.userId);
}

function readGuestShortlists(): Shortlist[] {
  try {
    return JSON.parse(window.localStorage.getItem(GUEST_SHORTLISTS_KEY) ?? '[]') as Shortlist[];
  } catch {
    return [];
  }
}

function writeGuestShortlists(lists: Shortlist[]) {
  window.localStorage.setItem(GUEST_SHORTLISTS_KEY, JSON.stringify(lists));
}

async function syncGuestToServer(lists: Shortlist[]) {
  await fetch('/api/v1/guest/workspace', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      favouriteListingIds: [],
      comparisonListingIds: [],
      recentViewListingIds: [],
      savedSearchCriteria: [],
      shortlists: lists.map((l) => ({
        name: l.name,
        isDefault: l.isDefault,
        listingIds: l.listingIds,
        note: l.note ?? undefined,
      })),
      preferenceWeights: {},
      propertyNotes: [],
    }),
  });
}

export function WorkspaceShortlistsClient({ locale, labels }: { locale: string; labels: Labels }) {
  const [signedIn, setSignedIn] = useState(false);
  const [items, setItems] = useState<Shortlist[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await hasSession();
      setSignedIn(ok);
      if (ok) {
        const res = await fetch('/api/v1/me/shortlists', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('load');
        const data = (await res.json()) as { items: Shortlist[] };
        setItems(data.items);
      } else {
        setItems(readGuestShortlists());
        await fetch('/api/v1/guest/workspace', { credentials: 'same-origin' });
      }
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (signedIn) {
      const res = await fetch('/api/v1/me/shortlists', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        setError(labels.error);
        return;
      }
      setName('');
      await load();
      return;
    }
    const next = [
      ...readGuestShortlists(),
      { name: trimmed, isDefault: readGuestShortlists().length === 0, listingIds: [] },
    ];
    writeGuestShortlists(next);
    await syncGuestToServer(next);
    setName('');
    setItems(next);
  }

  if (loading) return <p>{labels.loading}</p>;

  return (
    <div data-testid="workspace-shortlists">
      {!signedIn && (
        <p className="banner" role="status">
          {labels.signInBanner} <Link href={`/${locale}/account`}>{labels.signInBanner}</Link>
          <br />
          <span>{labels.guestLocal}</span>
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label>
          <span className="sr-only">{labels.createShortlist}</span>
          <input
            data-testid="shortlist-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.namePlaceholder}
            aria-label={labels.createShortlist}
          />
        </label>
        <button type="button" data-testid="create-shortlist" onClick={() => void create()}>
          {labels.createShortlist}
        </button>
      </div>
      {items.length === 0 ? (
        <p>{labels.emptyShortlists}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map((item) => (
            <li
              key={item.id ?? item.name}
              style={{
                borderBottom: '1px solid hsl(var(--border))',
                padding: '0.75rem 0',
              }}
            >
              <Link
                href={`/${locale}/workspace/shortlists/${encodeURIComponent(item.id ?? item.name)}`}
                data-testid="shortlist-link"
              >
                <strong>{item.name}</strong>
                {item.isDefault ? ` (${labels.default})` : ''}
              </Link>
              <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                {labels.items}: {item.itemCount ?? item.listingIds?.length ?? 0}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: '1.5rem' }}>
        <Link href={`/${locale}/workspace/compare`}>{labels.compare}</Link>
      </p>
    </div>
  );
}

export {
  GUEST_SHORTLISTS_KEY,
  readGuestShortlists,
  writeGuestShortlists,
  syncGuestToServer,
  hasSession,
};
