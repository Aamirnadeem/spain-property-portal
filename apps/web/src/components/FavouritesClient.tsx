'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPriceEur, type ListingCardDto } from '@spain/domain';

const FAV_KEY = 'spain_guest_favourites';

export function FavouritesClient({
  locale,
  labels,
}: {
  locale: string;
  labels: { title: string; empty: string; guestHint: string; signedInHint: string };
}) {
  const [items, setItems] = useState<ListingCardDto[]>([]);
  const [mode, setMode] = useState<'guest' | 'user'>('guest');

  useEffect(() => {
    void (async () => {
      const sessionRes = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
      const session = sessionRes.ok
        ? ((await sessionRes.json()) as { userId?: string | null })
        : null;

      if (session?.userId) {
        setMode('user');
        const res = await fetch('/api/v1/favourites', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items ?? []);
        }
        return;
      }

      setMode('guest');
      const ids = JSON.parse(window.localStorage.getItem(FAV_KEY) ?? '[]') as string[];
      const details: ListingCardDto[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/v1/properties/${id}`);
        if (res.ok) details.push(await res.json());
      }
      setItems(details);
    })();
  }, []);

  return (
    <section data-testid="favourites-page">
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{labels.title}</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))' }}>
        {mode === 'guest' ? labels.guestHint : labels.signedInHint}
      </p>
      {items.length === 0 ? (
        <p>{labels.empty}</p>
      ) : (
        <ul className="card-grid">
          {items.map((item) => (
            <li key={item.id} className="property-card">
              <Link href={`/${locale}/properties/${item.id}`}>
                <h3>{item.title}</h3>
                <p>{formatPriceEur(item.priceAmount)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
