'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { formatPriceEur, type ListingCardDto } from '@spain/domain';
import { parseSearchParams, toSearchParams, type PropertySearchCriteria } from '@spain/search';
import { SaveSearchControl } from './SaveSearchControl';

type SearchLabels = {
  filters: string;
  query: string;
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  minSize: string;
  maxSize: string;
  area: string;
  environment: string;
  allEnvironments: string;
  cityCenter: string;
  coastal: string;
  hillside: string;
  apply: string;
  clear: string;
  cards: string;
  table: string;
  sort: string;
  sortNewest: string;
  sortPriceAsc: string;
  sortPriceDesc: string;
  sortSize: string;
  empty: string;
  error: string;
  results: string;
  snapshotBadge: string;
  page: string;
  previous: string;
  next: string;
  saveSearch?: string;
  searchSaved?: string;
  saveSearchName?: string;
};

export function PropertySearchClient({ locale, labels }: { locale: string; labels: SearchLabels }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const criteria = useMemo(
    () => parseSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [items, setItems] = useState<ListingCardDto[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(criteria);

  useEffect(() => {
    setDraft(criteria);
  }, [criteria]);

  const load = useCallback(
    async (next: PropertySearchCriteria) => {
      setError(null);
      const qs = toSearchParams(next).toString();
      const res = await fetch(`/api/v1/properties?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(labels.error);
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    },
    [labels.error],
  );

  useEffect(() => {
    void load(criteria);
  }, [criteria, load]);

  function pushCriteria(next: PropertySearchCriteria) {
    const qs = toSearchParams(next).toString();
    startTransition(() => {
      router.push(`/${locale}/search${qs ? `?${qs}` : ''}`);
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / criteria.pageSize));

  return (
    <div className="search-layout" data-testid="property-search">
      <aside className="search-filters" aria-label={labels.filters}>
        <h2>{labels.filters}</h2>
        <label>
          {labels.query}
          <input
            data-testid="search-query"
            value={draft.q ?? ''}
            onChange={(e) => setDraft({ ...draft, q: e.target.value || undefined })}
          />
        </label>
        <label>
          {labels.minPrice}
          <input
            type="number"
            value={draft.minPrice ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                minPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label>
          {labels.maxPrice}
          <input
            type="number"
            value={draft.maxPrice ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label>
          {labels.bedrooms}
          <input
            type="number"
            min={0}
            value={draft.minBedrooms ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                minBedrooms: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label>
          {labels.minSize}
          <input
            type="number"
            value={draft.minSizeSqm ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                minSizeSqm: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label>
          {labels.maxSize}
          <input
            type="number"
            value={draft.maxSizeSqm ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                maxSizeSqm: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label>
          {labels.area}
          <input
            value={draft.area ?? ''}
            onChange={(e) => setDraft({ ...draft, area: e.target.value || undefined })}
            list="areas"
          />
          <datalist id="areas">
            {['Eixample', 'Sant Gervasi', 'Sitges', 'Maresme', 'Gavà Mar', 'Vallvidrera'].map(
              (a) => (
                <option key={a} value={a} />
              ),
            )}
          </datalist>
        </label>
        <label>
          {labels.environment}
          <select
            value={draft.environmentType ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                environmentType: (e.target.value || undefined) as
                  PropertySearchCriteria['environmentType'] | undefined,
              })
            }
          >
            <option value="">{labels.allEnvironments}</option>
            <option value="city_center">{labels.cityCenter}</option>
            <option value="coastal">{labels.coastal}</option>
            <option value="hillside">{labels.hillside}</option>
          </select>
        </label>
        <div className="filter-actions">
          <button type="button" onClick={() => pushCriteria({ ...draft, page: 1 })}>
            {labels.apply}
          </button>
          <button
            type="button"
            onClick={() => pushCriteria(parseSearchParams(new URLSearchParams()))}
          >
            {labels.clear}
          </button>
        </div>
      </aside>

      <section className="search-results">
        <div className="search-toolbar">
          <p aria-live="polite">
            {total} {labels.results}
            {pending ? '…' : ''}
          </p>
          <SaveSearchControl
            criteria={criteria as unknown as Record<string, unknown>}
            labels={{
              saveSearch: labels.saveSearch ?? 'Save search',
              saveSearchName: labels.saveSearchName ?? 'Name this search',
              searchSaved: labels.searchSaved ?? 'Search saved',
              error: labels.error,
            }}
          />
          <div className="view-toggle" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={criteria.view === 'cards'}
              onClick={() => pushCriteria({ ...criteria, view: 'cards' })}
            >
              {labels.cards}
            </button>
            <button
              type="button"
              aria-pressed={criteria.view === 'table'}
              onClick={() => pushCriteria({ ...criteria, view: 'table' })}
            >
              {labels.table}
            </button>
          </div>
          <label>
            {labels.sort}
            <select
              value={criteria.sort}
              onChange={(e) =>
                pushCriteria({
                  ...criteria,
                  sort: e.target.value as PropertySearchCriteria['sort'],
                  page: 1,
                })
              }
            >
              <option value="newest">{labels.sortNewest}</option>
              <option value="price_asc">{labels.sortPriceAsc}</option>
              <option value="price_desc">{labels.sortPriceDesc}</option>
              <option value="size_desc">{labels.sortSize}</option>
            </select>
          </label>
        </div>

        {error ? (
          <p role="alert" className="search-error">
            {error}
          </p>
        ) : null}
        {!error && items.length === 0 ? (
          <p className="search-empty" data-testid="search-empty">
            {labels.empty}
          </p>
        ) : null}

        {criteria.view === 'table' ? (
          <div className="table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Price</th>
                  <th>Beds</th>
                  <th>Size</th>
                  <th>Area</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/${locale}/properties/${item.id}`}>{item.title}</Link>
                    </td>
                    <td>{formatPriceEur(item.priceAmount)}</td>
                    <td>{item.bedrooms ?? '—'}</td>
                    <td>{item.builtAreaSqm ?? '—'} m²</td>
                    <td>{item.areaLabel ?? '—'}</td>
                    <td>
                      {item.isLegacySnapshot ? (
                        <span className="badge">{labels.snapshotBadge}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="card-grid">
            {items.map((item) => (
              <li key={item.id} className="property-card">
                <Link href={`/${locale}/properties/${item.id}`}>
                  <div className="card-media" aria-hidden="true">
                    <span>No photo</span>
                  </div>
                  <div className="card-body">
                    {item.isLegacySnapshot ? (
                      <span className="badge">{labels.snapshotBadge}</span>
                    ) : null}
                    <h3>{item.title}</h3>
                    <p className="price">{formatPriceEur(item.priceAmount)}</p>
                    <p>
                      {item.bedrooms ?? '—'} bed · {item.builtAreaSqm ?? '—'} m² · {item.areaLabel}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <nav className="pagination" aria-label="Pagination">
          <button
            type="button"
            disabled={criteria.page <= 1}
            onClick={() => pushCriteria({ ...criteria, page: criteria.page - 1 })}
          >
            {labels.previous}
          </button>
          <span>
            {labels.page} {criteria.page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={criteria.page >= totalPages}
            onClick={() => pushCriteria({ ...criteria, page: criteria.page + 1 })}
          >
            {labels.next}
          </button>
        </nav>
      </section>
    </div>
  );
}
