'use client';

import { useEffect, useState } from 'react';
import { readSpainUserId } from '@/lib/demo-identities';

interface PartnerListingRow {
  id: string;
  title: string;
  externalListingId: string | null;
  operationalStatus: string;
  isPublicBrowseable: boolean;
  priceAmount: string | null;
  currency: string;
  areaLabel: string | null;
  updatedAt: string;
}

type Labels = {
  listingsTitle: string;
  listingsEmpty: string;
  status: string;
  price: string;
  newPrice: string;
  updatePrice: string;
  withdraw: string;
  withdrawConfirm: string;
};

export function PartnerListingsClient({ labels }: { labels: Labels }) {
  const [items, setItems] = useState<PartnerListingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const userId = readSpainUserId();
    if (!userId) {
      setError('not_signed_in');
      return;
    }
    const res = await fetch('/api/v1/partner/listings', { headers: { 'x-user-id': userId } });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'load_failed');
      return;
    }
    const data = await res.json();
    setItems(data.items ?? []);
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function updatePrice(listingId: string) {
    const userId = readSpainUserId();
    const priceAmount = Number(drafts[listingId]);
    if (!userId || !priceAmount || priceAmount <= 0) return;
    setBusyId(listingId);
    await fetch(`/api/v1/partner/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ priceAmount }),
    });
    setBusyId(null);
    await load();
  }

  async function withdraw(listingId: string) {
    const userId = readSpainUserId();
    if (!userId) return;
    if (!window.confirm(labels.withdrawConfirm)) return;
    setBusyId(listingId);
    await fetch(`/api/v1/partner/listings/${listingId}/withdraw`, {
      method: 'POST',
      headers: { 'x-user-id': userId },
    });
    setBusyId(null);
    await load();
  }

  return (
    <section data-testid="partner-listings">
      <h2>{labels.listingsTitle}</h2>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {items.length === 0 && !error ? (
        <p>{labels.listingsEmpty}</p>
      ) : (
        <div className="table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>{labels.status}</th>
                <th>{labels.price}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  data-testid={`partner-listing-row-${item.externalListingId ?? item.id}`}
                >
                  <td>
                    {item.title}
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {item.externalListingId} · {item.areaLabel ?? '—'}
                    </div>
                  </td>
                  <td>
                    <span className="badge">{item.operationalStatus}</span>
                  </td>
                  <td>
                    {item.priceAmount
                      ? `${Number(item.priceAmount).toLocaleString()} ${item.currency}`
                      : '—'}
                  </td>
                  <td
                    style={{
                      display: 'flex',
                      gap: '0.4rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <input
                      type="number"
                      min={1}
                      placeholder={labels.newPrice}
                      value={drafts[item.id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                      data-testid={`partner-price-input-${item.externalListingId ?? item.id}`}
                      style={{
                        width: 120,
                        padding: '0.35rem',
                        borderRadius: 6,
                        border: '1px solid hsl(var(--border))',
                      }}
                    />
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => updatePrice(item.id)}
                      data-testid={`partner-update-price-${item.externalListingId ?? item.id}`}
                    >
                      {labels.updatePrice}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id || item.operationalStatus === 'withdrawn'}
                      onClick={() => withdraw(item.id)}
                      data-testid={`partner-withdraw-${item.externalListingId ?? item.id}`}
                    >
                      {labels.withdraw}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
