'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  hasSession,
  readGuestSavedSearches,
  syncGuestPhase4bToServer,
  writeGuestSavedSearches,
  type GuestSavedSearchLocal,
} from '@/lib/guest-phase4b';
import { toSearchParams, type PropertySearchCriteria } from '@spain/search';

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

function guestToUi(item: GuestSavedSearchLocal): SavedSearch {
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

function criteriaSummary(criteria: Record<string, unknown>): string {
  const parts: string[] = [];
  if (criteria.q) parts.push(String(criteria.q));
  if (criteria.area) parts.push(String(criteria.area));
  if (criteria.minPrice != null || criteria.maxPrice != null) {
    parts.push(`${criteria.minPrice ?? '…'}–${criteria.maxPrice ?? '…'} €`);
  }
  if (criteria.minBedrooms != null) parts.push(`${criteria.minBedrooms}+ bed`);
  if (criteria.sort) parts.push(String(criteria.sort));
  return parts.join(' · ') || '—';
}

export function WorkspaceSearchDetailClient({
  locale,
  searchId,
  labels,
}: {
  locale: string;
  searchId: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [item, setItem] = useState<SavedSearch | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await hasSession();
      setSignedIn(ok);
      if (!ok) {
        const found = readGuestSavedSearches().find((s) => s.id === searchId);
        if (!found) {
          setError(labels.error);
          setItem(null);
          return;
        }
        const ui = guestToUi(found);
        setItem(ui);
        setName(ui.name);
        return;
      }
      const res = await fetch(`/api/v1/me/saved-searches/${searchId}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { item: SavedSearch };
      setItem(data.item);
      setName(data.item.name);
    } catch {
      setError(labels.error);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [labels.error, searchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rename() {
    const trimmed = name.trim();
    if (!trimmed || !item) return;
    setBusy(true);
    setError(null);
    try {
      if (!signedIn) {
        const next = readGuestSavedSearches().map((s) =>
          s.id === searchId ? { ...s, name: trimmed } : s,
        );
        writeGuestSavedSearches(next);
        await syncGuestPhase4bToServer({ savedSearches: next });
        setItem({ ...item, name: trimmed });
        return;
      }
      const res = await fetch(`/api/v1/me/saved-searches/${searchId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error('rename');
      const data = (await res.json()) as { item: SavedSearch };
      setItem(data.item);
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  }

  async function toggleAlerts() {
    if (!item || !signedIn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/me/saved-searches/${searchId}/alerts`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: !item.alertsEnabled }),
      });
      if (!res.ok) throw new Error('alerts');
      const data = (await res.json()) as { item: SavedSearch };
      setItem(data.item);
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  }

  async function runEvaluation() {
    if (!signedIn) return;
    setBusy(true);
    setError(null);
    setRunMessage(null);
    try {
      const res = await fetch(`/api/v1/me/saved-searches/${searchId}/run`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('run');
      const data = (await res.json()) as {
        matchCount?: number;
        status?: string;
      };
      setRunMessage(
        `${labels.matchCount}: ${data.matchCount ?? 0}${data.status ? ` (${data.status})` : ''}`,
      );
      await load();
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      if (!signedIn) {
        const next = readGuestSavedSearches().filter((s) => s.id !== searchId);
        writeGuestSavedSearches(next);
        await syncGuestPhase4bToServer({ savedSearches: next });
        router.push(`/${locale}/workspace/searches`);
        return;
      }
      const res = await fetch(`/api/v1/me/saved-searches/${searchId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('delete');
      router.push(`/${locale}/workspace/searches`);
    } catch {
      setError(labels.error);
      setBusy(false);
    }
  }

  if (loading) return <p>{labels.loading}</p>;
  if (!item) {
    return (
      <div>
        <p role="alert">{error ?? labels.error}</p>
        <Link href={`/${locale}/workspace/searches`}>{labels.searches}</Link>
      </div>
    );
  }

  const qs = (() => {
    try {
      return toSearchParams(item.criteria as PropertySearchCriteria).toString();
    } catch {
      return '';
    }
  })();

  return (
    <div data-testid="saved-search-detail">
      <p>
        <Link href={`/${locale}/workspace/searches`}>{labels.searches}</Link>
      </p>
      {!signedIn ? (
        <p className="banner" role="status">
          {labels.signInBanner}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{item.name}</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))' }}>{criteriaSummary(item.criteria)}</p>
      <p>
        <Link href={`/${locale}/search${qs ? `?${qs}` : ''}`}>
          {labels.openSearch ?? 'Open search'}
        </Link>
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '1rem 0' }}>
        <label>
          <span className="sr-only">{labels.rename}</span>
          <input
            data-testid="rename-saved-search"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={labels.rename}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => void rename()}>
          {labels.rename}
        </button>
        <button type="button" disabled={busy} onClick={() => void remove()}>
          {labels.delete}
        </button>
      </div>

      <section aria-labelledby="alert-settings-heading" style={{ marginTop: '1.5rem' }}>
        <h2 id="alert-settings-heading" style={{ fontSize: '1.1rem' }}>
          {labels.alertSettings}
        </h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            data-testid="enable-alerts"
            checked={item.alertsEnabled}
            disabled={!signedIn || busy}
            onChange={() => void toggleAlerts()}
          />
          {labels.alertsEnabled}
        </label>
        {!signedIn ? (
          <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
            {labels.signInBanner}
          </p>
        ) : null}
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <button
          type="button"
          data-testid="run-evaluation"
          disabled={!signedIn || busy}
          onClick={() => void runEvaluation()}
        >
          {labels.runEvaluation}
        </button>
        {runMessage ? (
          <p role="status" data-testid="evaluation-result">
            {runMessage}
          </p>
        ) : null}
        <dl style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
          <div>
            <dt style={{ display: 'inline', fontWeight: 600 }}>{labels.lastEvaluated}: </dt>
            <dd style={{ display: 'inline' }}>
              {item.lastEvaluatedAt ? new Date(item.lastEvaluatedAt).toLocaleString(locale) : '—'}
            </dd>
          </div>
          <div>
            <dt style={{ display: 'inline', fontWeight: 600 }}>{labels.matchCount}: </dt>
            <dd style={{ display: 'inline' }}>
              {item.lastMatchCount != null ? item.lastMatchCount : '—'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
