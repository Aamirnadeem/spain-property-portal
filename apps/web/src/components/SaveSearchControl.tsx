'use client';

import { useState } from 'react';
import {
  criteriaForSave,
  hasSession,
  readGuestSavedSearches,
  syncGuestPhase4bToServer,
  writeGuestSavedSearches,
  type GuestSavedSearchLocal,
} from '@/lib/guest-phase4b';

type Labels = {
  saveSearch: string;
  saveSearchName: string;
  searchSaved: string;
  error: string;
};

export function SaveSearchControl({
  criteria,
  labels,
}: {
  criteria: Record<string, unknown>;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const normalized = criteriaForSave(criteria);
    try {
      if (await hasSession()) {
        const res = await fetch('/api/v1/me/saved-searches', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: trimmed, criteria: normalized }),
        });
        if (!res.ok) {
          setError(labels.error);
          return;
        }
      } else {
        const guestItem: GuestSavedSearchLocal = {
          id: crypto.randomUUID(),
          name: trimmed,
          criteria: normalized,
          criteriaVersion: 'phase4b.v1',
          alertsEnabled: false,
          alertTypes: [],
        };
        const next = [guestItem, ...readGuestSavedSearches()].slice(0, 5);
        writeGuestSavedSearches(next);
        await syncGuestPhase4bToServer({ savedSearches: next });
      }
      setMessage(labels.searchSaved);
      setName('');
      setOpen(false);
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <button
        type="button"
        data-testid="save-search-button"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setMessage(null);
          setError(null);
        }}
      >
        {labels.saveSearch}
      </button>
      {open ? (
        <>
          <label>
            <span className="sr-only">{labels.saveSearchName}</span>
            <input
              data-testid="save-search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={labels.saveSearchName}
              aria-label={labels.saveSearchName}
            />
          </label>
          <button
            type="button"
            data-testid="save-search-confirm"
            disabled={busy || !name.trim()}
            onClick={() => void confirm()}
          >
            {labels.saveSearch}
          </button>
        </>
      ) : null}
      {message ? (
        <span role="status" style={{ fontSize: '0.875rem' }}>
          {message}
        </span>
      ) : null}
      {error ? (
        <span role="alert" style={{ color: 'crimson', fontSize: '0.875rem' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
