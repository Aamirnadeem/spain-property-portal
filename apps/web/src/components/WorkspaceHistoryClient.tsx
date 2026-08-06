'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  hasSession,
  readGuestBrowsingHistory,
  syncGuestPhase4bToServer,
  writeGuestBrowsingHistory,
  type GuestBrowsingHistoryLocal,
} from '@/lib/guest-phase4b';

type HistoryItem = {
  listingId: string;
  title: string;
  priceAmount: number | null;
  lastViewedAt: string;
  viewCount: number;
};

function guestToHistoryItem(h: GuestBrowsingHistoryLocal): HistoryItem {
  const title =
    typeof h.context?.title === 'string' && h.context.title
      ? h.context.title
      : h.listingId.slice(0, 8);
  return {
    listingId: h.listingId,
    title,
    priceAmount: null,
    lastViewedAt: h.lastViewedAt,
    viewCount: h.viewCount,
  };
}

export function WorkspaceHistoryClient({
  locale,
  labels,
}: {
  locale: string;
  labels: Record<string, string>;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await hasSession();
      setSignedIn(ok);
      if (!ok) {
        setItems(readGuestBrowsingHistory().map(guestToHistoryItem));
        await fetch('/api/v1/guest/workspace', { credentials: 'same-origin' });
        return;
      }
      const res = await fetch('/api/v1/me/history', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { items: HistoryItem[] };
      setItems(data.items);
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clearOne(listingId: string) {
    setError(null);
    if (!signedIn) {
      const next = readGuestBrowsingHistory().filter((h) => h.listingId !== listingId);
      writeGuestBrowsingHistory(next);
      await syncGuestPhase4bToServer({ browsingHistory: next });
      setItems(next.map(guestToHistoryItem));
      return;
    }
    const res = await fetch(`/api/v1/me/history/${listingId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      setError(labels.error);
      return;
    }
    await load();
  }

  async function clearAll() {
    setError(null);
    if (!signedIn) {
      writeGuestBrowsingHistory([]);
      await syncGuestPhase4bToServer({ browsingHistory: [] });
      setItems([]);
      return;
    }
    const res = await fetch('/api/v1/me/history', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      setError(labels.error);
      return;
    }
    setItems([]);
  }

  if (loading) return <p>{labels.loading}</p>;

  return (
    <div data-testid="workspace-history">
      {!signedIn ? (
        <p className="banner" role="status">
          {labels.signInBanner} <Link href={`/${locale}/account`}>{labels.signInBanner}</Link>
          <br />
          <span>{labels.guestLocal}</span>
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          data-testid="clear-history"
          disabled={items.length === 0}
          onClick={() => void clearAll()}
        >
          {labels.clearHistory}
        </button>
      </div>

      {items.length === 0 ? (
        <p>{labels.emptyHistory}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map((item) => (
            <li
              key={item.listingId}
              data-testid="history-item"
              style={{
                borderBottom: '1px solid hsl(var(--border))',
                padding: '0.75rem 0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <Link href={`/${locale}/properties/${item.listingId}`}>{item.title}</Link>
                <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                  {new Date(item.lastViewedAt).toLocaleString(locale)} · ×{item.viewCount}
                </div>
              </div>
              <button
                type="button"
                data-testid="clear-history-item"
                aria-label={labels.clearOne}
                onClick={() => void clearOne(item.listingId)}
              >
                {labels.clearOne}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
