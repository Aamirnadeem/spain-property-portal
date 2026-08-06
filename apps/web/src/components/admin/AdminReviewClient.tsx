'use client';

import { useEffect, useState } from 'react';

interface ReviewListingRow {
  id: string;
  title: string;
  externalListingId: string | null;
  operationalStatus: string;
  priceAmount: string | null;
  currency: string;
  areaLabel: string | null;
  organizationId: string | null;
  importedAt: string | null;
}

type Labels = {
  reviewTitle: string;
  reviewEmpty: string;
  publish: string;
  withdraw: string;
};

export function AdminReviewClient({ labels }: { labels: Labels }) {
  const [items, setItems] = useState<ReviewListingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/v1/admin/listings', { credentials: 'same-origin' });
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

  async function act(listingId: string, action: 'publish' | 'withdraw') {
    setBusyId(listingId);
    await fetch(`/api/v1/admin/listings/${listingId}/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    setBusyId(null);
    await load();
  }

  return (
    <section data-testid="admin-review">
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{labels.reviewTitle}</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {items.length === 0 && !error ? (
        <p>{labels.reviewEmpty}</p>
      ) : (
        <div className="table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Price</th>
                <th>Area</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  data-testid={`admin-review-row-${item.externalListingId ?? item.id}`}
                >
                  <td>
                    {item.title}
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {item.externalListingId}
                    </div>
                  </td>
                  <td>
                    {item.priceAmount
                      ? `${Number(item.priceAmount).toLocaleString()} ${item.currency}`
                      : '—'}
                  </td>
                  <td>{item.areaLabel ?? '—'}</td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => act(item.id, 'publish')}
                      data-testid={`admin-publish-${item.externalListingId ?? item.id}`}
                    >
                      {labels.publish}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => act(item.id, 'withdraw')}
                      data-testid={`admin-withdraw-${item.externalListingId ?? item.id}`}
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
