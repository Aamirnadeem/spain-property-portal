'use client';

import { useEffect, useState } from 'react';
import {
  hasSession,
  readGuestShortlists,
  writeGuestShortlists,
  syncGuestToServer,
} from './WorkspaceShortlistsClient';

export function AddToShortlistControl({ listingId, label }: { listingId: string; label: string }) {
  const [lists, setLists] = useState<Array<{ id?: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (await hasSession()) {
        const res = await fetch('/api/v1/me/shortlists', { credentials: 'same-origin' });
        if (res.ok) {
          const data = (await res.json()) as { items: Array<{ id: string; name: string }> };
          setLists(data.items);
        }
      } else {
        setLists(readGuestShortlists());
      }
    })();
  }, [open]);

  async function addTo(list: { id?: string; name: string }) {
    setMessage(null);
    if (await hasSession()) {
      if (!list.id) return;
      const res = await fetch(`/api/v1/me/shortlists/${list.id}/items`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
      setMessage(res.ok ? 'ok' : 'error');
      setOpen(false);
      return;
    }
    const next = readGuestShortlists().map((s) =>
      s.name === list.name ? { ...s, listingIds: [...new Set([...s.listingIds, listingId])] } : s,
    );
    if (!next.some((s) => s.name === list.name)) {
      next.push({ name: list.name || 'My shortlist', isDefault: true, listingIds: [listingId] });
    }
    writeGuestShortlists(next);
    await syncGuestToServer(next);
    setMessage('ok');
    setOpen(false);
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <button type="button" data-testid="add-to-shortlist" onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <ul data-testid="shortlist-picker" style={{ listStyle: 'none', padding: 0 }}>
          {lists.length === 0 && (
            <li>
              <button type="button" onClick={() => void addTo({ name: 'My shortlist' })}>
                My shortlist
              </button>
            </li>
          )}
          {lists.map((l) => (
            <li key={l.id ?? l.name}>
              <button type="button" onClick={() => void addTo(l)}>
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message === 'ok' && <span className="sr-only">Added</span>}
    </div>
  );
}
