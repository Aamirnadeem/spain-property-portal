'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  criteriaForSave,
  hasSession,
  readGuestSavedSearches,
  syncGuestPhase4bToServer,
  writeGuestSavedSearches,
  type GuestSavedSearchLocal,
} from '@/lib/guest-phase4b';

type SavedSearch = {
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  criteriaVersion: string;
  alertsEnabled: boolean;
  alertTypes: string[];
  lastEvaluatedAt: string | null;
  lastMatchCount: number | null;
  lastEvaluationStatus: string | null;
};

function toUiItem(item: GuestSavedSearchLocal): SavedSearch {
  return {
    id: item.id,
    name: item.name,
    criteria: item.criteria,
    criteriaVersion: item.criteriaVersion ?? 'phase4b.v1',
    alertsEnabled: Boolean(item.alertsEnabled),
    alertTypes: item.alertTypes ?? [],
    lastEvaluatedAt: item.lastEvaluatedAt ?? null,
    lastMatchCount: item.lastMatchCount ?? null,
    lastEvaluationStatus: item.lastEvaluationStatus ?? null,
  };
}

export function WorkspaceSearchesClient({
  locale,
  labels,
}: {
  locale: string;
  labels: Record<string, string>;
}) {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [name, setName] = useState('');
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
        setItems(readGuestSavedSearches().map(toUiItem));
        await fetch('/api/v1/guest/workspace', { credentials: 'same-origin' });
        return;
      }
      const res = await fetch('/api/v1/me/saved-searches', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load_failed');
      const data = (await res.json()) as { items: SavedSearch[] };
      setItems(data.items);
    } catch {
      setError(labels.error ?? 'Error');
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
    const criteria = criteriaForSave({ q: trimmed, sort: 'newest' });
    if (!signedIn) {
      const guestItem: GuestSavedSearchLocal = {
        id: crypto.randomUUID(),
        name: trimmed,
        criteria,
        criteriaVersion: 'phase4b.v1',
        alertsEnabled: false,
        alertTypes: [],
        lastEvaluatedAt: null,
        lastMatchCount: null,
        lastEvaluationStatus: null,
      };
      const next = [guestItem, ...readGuestSavedSearches()].slice(0, 5);
      writeGuestSavedSearches(next);
      await syncGuestPhase4bToServer({ savedSearches: next });
      setItems(next.map(toUiItem));
      setName('');
      return;
    }
    const res = await fetch('/api/v1/me/saved-searches', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed, criteria }),
    });
    if (!res.ok) {
      setError(labels.error ?? 'Error');
      return;
    }
    setName('');
    await load();
  }

  if (loading) return <p>{labels.loading}</p>;

  return (
    <div data-testid="workspace-searches">
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
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <label>
          <span className="sr-only">{labels.namePlaceholder}</span>
          <input
            data-testid="saved-search-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.namePlaceholder}
            aria-label={labels.createSavedSearch}
          />
        </label>
        <button type="button" data-testid="create-saved-search" onClick={() => void create()}>
          {labels.createSavedSearch}
        </button>
      </div>
      {items.length === 0 ? (
        <p>{labels.emptySearches}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                borderBottom: '1px solid hsl(var(--border))',
                padding: '0.75rem 0',
              }}
            >
              <Link
                data-testid="saved-search-link"
                href={`/${locale}/workspace/searches/${item.id}`}
              >
                <strong>{item.name}</strong>
              </Link>
              {item.alertsEnabled ? (
                <span style={{ marginInlineStart: '0.5rem', fontSize: '0.875rem' }}>
                  · {labels.alertsEnabled}
                </span>
              ) : null}
              {item.lastMatchCount != null ? (
                <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                  {labels.matchCount}: {item.lastMatchCount}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
