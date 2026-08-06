'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPriceEur, type ListingDetailDto } from '@spain/domain';
import { AddToShortlistControl } from './AddToShortlistControl';

const FAV_KEY = 'spain_guest_favourites';

function readGuestFavs(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(FAV_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function writeGuestFavs(ids: string[]) {
  window.localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

export function PropertyDetailClient({
  locale,
  listingId,
  labels,
}: {
  locale: string;
  listingId: string;
  labels: Record<string, string>;
}) {
  const [detail, setDetail] = useState<ListingDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/v1/properties/${listingId}`);
      if (!res.ok) {
        setError('not_found');
        return;
      }
      const data = (await res.json()) as ListingDetailDto;
      setDetail(data);
      setFavourited(readGuestFavs().includes(listingId));
    })();
  }, [listingId]);

  async function toggleFavourite() {
    const sessionRes = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
    const session = sessionRes.ok
      ? ((await sessionRes.json()) as { userId?: string | null })
      : null;

    if (session?.userId) {
      if (favourited) {
        await fetch(`/api/v1/favourites?listingId=${listingId}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        setFavourited(false);
      } else {
        await fetch('/api/v1/favourites', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ listingId }),
        });
        setFavourited(true);
      }
      return;
    }

    const current = readGuestFavs();
    if (favourited) {
      writeGuestFavs(current.filter((id) => id !== listingId));
      setFavourited(false);
    } else {
      writeGuestFavs([...current, listingId]);
      setFavourited(true);
    }
  }

  if (error) {
    return <p role="alert">Property not found.</p>;
  }
  if (!detail) {
    return <p>Loading…</p>;
  }

  return (
    <article className="property-detail" data-testid="property-detail">
      <Link href={`/${locale}/search`}>{labels.back}</Link>
      <div className="detail-media" role="img" aria-label={labels.noImage}>
        <span>{labels.noImage}</span>
      </div>
      {detail.isLegacySnapshot ? <span className="badge">Legacy snapshot</span> : null}
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{detail.title}</h1>
      <p className="price">{formatPriceEur(detail.priceAmount)}</p>
      <p className="freshness-warning" role="status">
        {detail.freshnessWarning}
      </p>
      <dl className="detail-grid">
        <div>
          <dt>{labels.location}</dt>
          <dd>{detail.areaLabel ?? detail.addressText ?? '—'}</dd>
        </div>
        <div>
          <dt>{labels.bedrooms}</dt>
          <dd>{detail.bedrooms ?? '—'}</dd>
        </div>
        <div>
          <dt>{labels.bathrooms}</dt>
          <dd>{detail.bathrooms ?? labels.unavailableBaths}</dd>
        </div>
        <div>
          <dt>{labels.size}</dt>
          <dd>{detail.builtAreaSqm ? `${detail.builtAreaSqm} m²` : '—'}</dd>
        </div>
        <div>
          <dt>{labels.pricePerSqm}</dt>
          <dd>{detail.pricePerSqm != null ? formatPriceEur(detail.pricePerSqm) : '—'}</dd>
        </div>
        <div>
          <dt>{labels.transport}</dt>
          <dd>{detail.nearestTransit ?? '—'}</dd>
        </div>
        <div>
          <dt>{labels.proximity}</dt>
          <dd>
            {[detail.beachProximity, detail.parkProximity].filter(Boolean).join(' · ') || '—'}
          </dd>
        </div>
        <div>
          <dt>{labels.source}</dt>
          <dd>{detail.sourceAttribution}</dd>
        </div>
      </dl>
      {detail.description ? <p>{detail.description}</p> : null}
      {detail.sourceUrl ? (
        <p>
          <a href={detail.sourceUrl} rel="noopener noreferrer" target="_blank">
            {labels.openSource}
          </a>
        </p>
      ) : null}
      <button type="button" onClick={toggleFavourite} data-testid="favourite-toggle">
        {favourited ? labels.removeFavourite : labels.addFavourite}
      </button>
      <AddToShortlistControl
        listingId={listingId}
        label={labels.addToShortlist ?? 'Add to shortlist'}
      />
    </article>
  );
}
