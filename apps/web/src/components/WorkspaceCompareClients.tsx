'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  COMPARISON_WEIGHT_KEYS,
  scoreComparisonSet,
  type ComparisonListingFacts,
} from '@spain/domain';
import {
  hasSession,
  readGuestShortlists,
  writeGuestShortlists,
  syncGuestToServer,
} from './WorkspaceShortlistsClient';

type Labels = Record<string, string>;

type Cell = { status: string; value?: unknown; reason?: string };

type ComparisonListing = {
  listingId: string;
  title: string;
  cells: Record<string, Cell>;
  score?: {
    score: number | null;
    factors: Array<{ key: string; weight: number; factScore: number; contribution: number }>;
    missing: string[];
    reason?: string;
  };
};

export function ShortlistDetailClient({
  locale,
  shortlistKey,
  labels,
}: {
  locale: string;
  shortlistKey: string;
  labels: Labels;
}) {
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState<string | null>(null);
  const [listingIds, setListingIds] = useState<string[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [propertyNotes, setPropertyNotes] = useState<
    Record<string, { body: string; positives: string; negatives: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await hasSession();
      setSignedIn(ok);
      if (ok) {
        const res = await fetch('/api/v1/me/shortlists', { credentials: 'same-origin' });
        const data = (await res.json()) as {
          items: Array<{
            id: string;
            name: string;
            listingIds: string[];
            note: string | null;
          }>;
        };
        const found = data.items.find((i) => i.id === shortlistKey);
        if (!found) {
          setError(labels.error);
          return;
        }
        setId(found.id);
        setName(found.name);
        setListingIds(found.listingIds);
        setNote(found.note ?? '');
        for (const lid of found.listingIds) {
          const nRes = await fetch(`/api/v1/me/notes/properties/${lid}`, {
            credentials: 'same-origin',
          });
          if (nRes.ok) {
            const nData = (await nRes.json()) as {
              note: { body: string; positives: string[]; negatives: string[] } | null;
            };
            if (nData.note) {
              setPropertyNotes((prev) => ({
                ...prev,
                [lid]: {
                  body: nData.note!.body,
                  positives: (nData.note!.positives ?? []).join(', '),
                  negatives: (nData.note!.negatives ?? []).join(', '),
                },
              }));
            }
          }
          const pRes = await fetch(`/api/v1/properties/${lid}`);
          if (pRes.ok) {
            const p = (await pRes.json()) as { title: string };
            setTitles((t) => ({ ...t, [lid]: p.title }));
          }
        }
      } else {
        await fetch('/api/v1/guest/workspace', { credentials: 'same-origin' });
        let guest = readGuestShortlists().find(
          (s) => s.name === decodeURIComponent(shortlistKey) || s.name === shortlistKey,
        );
        // Hydrate from server guest session if local cache empty
        if (!guest) {
          const gRes = await fetch('/api/v1/guest/workspace', { credentials: 'same-origin' });
          if (gRes.ok) {
            const gData = (await gRes.json()) as {
              payload: {
                shortlists?: Array<{
                  name: string;
                  isDefault?: boolean;
                  listingIds: string[];
                  note?: string;
                }>;
              };
            };
            const fromServer = (gData.payload.shortlists ?? []).map((s) => ({
              name: s.name,
              isDefault: s.isDefault,
              listingIds: s.listingIds ?? [],
              note: s.note ?? null,
            }));
            writeGuestShortlists(fromServer);
            guest = fromServer.find(
              (s) => s.name === decodeURIComponent(shortlistKey) || s.name === shortlistKey,
            );
          }
        }
        if (!guest) {
          setError(labels.error);
          return;
        }
        setName(guest.name);
        setListingIds(guest.listingIds);
        setNote(guest.note ?? '');
        for (const lid of guest.listingIds) {
          const pRes = await fetch(`/api/v1/properties/${lid}`);
          if (pRes.ok) {
            const p = (await pRes.json()) as { title: string };
            setTitles((t) => ({ ...t, [lid]: p.title }));
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [shortlistKey, labels.error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveShortlistNote() {
    if (signedIn && id) {
      await fetch(`/api/v1/me/shortlists/${id}/note`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: note }),
      });
      return;
    }
    const lists = readGuestShortlists().map((s) => (s.name === name ? { ...s, note } : s));
    writeGuestShortlists(lists);
    await syncGuestToServer(lists);
  }

  async function savePropertyNote(listingId: string) {
    const pn = propertyNotes[listingId] ?? { body: '', positives: '', negatives: '' };
    if (signedIn) {
      await fetch(`/api/v1/me/notes/properties/${listingId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body: pn.body,
          positives: pn.positives
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          negatives: pn.negatives
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
    }
  }

  async function removeItem(listingId: string) {
    if (signedIn && id) {
      await fetch(`/api/v1/me/shortlists/${id}/items?listingId=${listingId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      await load();
      return;
    }
    const lists = readGuestShortlists().map((s) =>
      s.name === name ? { ...s, listingIds: s.listingIds.filter((x) => x !== listingId) } : s,
    );
    writeGuestShortlists(lists);
    await syncGuestToServer(lists);
    setListingIds(lists.find((s) => s.name === name)?.listingIds ?? []);
  }

  const compareHref = useMemo(() => {
    const q = new URLSearchParams();
    selected.forEach((id) => q.append('id', id));
    return `/${locale}/workspace/compare?${q.toString()}`;
  }, [locale, selected]);

  if (loading) return <p>{labels.loading}</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <div data-testid="shortlist-detail">
      <h2>{name}</h2>
      <label>
        {labels.shortlistNote}
        <textarea
          data-testid="shortlist-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      <button type="button" onClick={() => void saveShortlistNote()}>
        {labels.saveNote}
      </button>

      <h3>{labels.items}</h3>
      {listingIds.length === 0 ? (
        <p>
          <Link href={`/${locale}/search`}>{labels.addProperty}</Link>
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {listingIds.map((lid) => (
            <li key={lid} style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  data-testid="compare-select"
                  checked={selected.includes(lid)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked ? [...prev, lid] : prev.filter((x) => x !== lid),
                    );
                  }}
                />
                <Link href={`/${locale}/properties/${lid}`}>{titles[lid] ?? lid}</Link>
              </label>
              <button type="button" onClick={() => void removeItem(lid)}>
                {labels.remove}
              </button>
              <fieldset style={{ marginTop: '0.5rem' }}>
                <legend>{labels.propertyNote}</legend>
                <textarea
                  data-testid={`property-note-${lid}`}
                  aria-label={labels.propertyNote}
                  value={propertyNotes[lid]?.body ?? ''}
                  onChange={(e) =>
                    setPropertyNotes((prev) => ({
                      ...prev,
                      [lid]: {
                        body: e.target.value,
                        positives: prev[lid]?.positives ?? '',
                        negatives: prev[lid]?.negatives ?? '',
                      },
                    }))
                  }
                  rows={2}
                  style={{ width: '100%' }}
                />
                <label>
                  {labels.positives}
                  <input
                    value={propertyNotes[lid]?.positives ?? ''}
                    onChange={(e) =>
                      setPropertyNotes((prev) => ({
                        ...prev,
                        [lid]: {
                          body: prev[lid]?.body ?? '',
                          positives: e.target.value,
                          negatives: prev[lid]?.negatives ?? '',
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  {labels.negatives}
                  <input
                    value={propertyNotes[lid]?.negatives ?? ''}
                    onChange={(e) =>
                      setPropertyNotes((prev) => ({
                        ...prev,
                        [lid]: {
                          body: prev[lid]?.body ?? '',
                          positives: prev[lid]?.positives ?? '',
                          negatives: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <button type="button" onClick={() => void savePropertyNote(lid)}>
                  {labels.saveNote}
                </button>
              </fieldset>
            </li>
          ))}
        </ul>
      )}

      {selected.length >= 2 && (
        <p>
          <Link data-testid="open-compare" href={compareHref}>
            {labels.openCompare}
          </Link>
        </p>
      )}
    </div>
  );
}

export function ComparisonClient({
  locale,
  initialIds,
  labels,
}: {
  locale: string;
  initialIds: string[];
  labels: Labels;
}) {
  const [listingIds] = useState(initialIds.slice(0, 5));
  const [weights, setWeights] = useState<Record<string, number>>({
    price: 5,
    size: 5,
    location: 5,
    commute: 3,
  });
  const [comparison, setComparison] = useState<{
    listings: ComparisonListing[];
    disclaimerKey: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runCompare() {
    if (listingIds.length < 2) {
      setError(labels.error);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ok = await hasSession();
      if (ok) {
        const res = await fetch('/api/v1/me/comparisons/preview', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ listingIds, weights, includeNotes: true }),
        });
        if (!res.ok) {
          setError(labels.error);
          return;
        }
        const data = (await res.json()) as { comparison: typeof comparison };
        setComparison(data.comparison);
        return;
      }

      // Guest: public listing facts + client-side scoring (no private notes)
      const facts: ComparisonListingFacts[] = [];
      const titles: Record<string, string> = {};
      for (const id of listingIds) {
        const res = await fetch(`/api/v1/properties/${id}`);
        if (!res.ok) continue;
        const p = (await res.json()) as {
          id: string;
          title: string;
          priceAmount: number | null;
          pricePerSqm: number | null;
          builtAreaSqm: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          areaLabel: string | null;
          environmentType: string | null;
          commuteMin: number | null;
          beachProximity: string | null;
          parkProximity: string | null;
          lastConfirmedAvailableAt: string | null;
        };
        titles[id] = p.title;
        facts.push({
          listingId: p.id,
          priceAmount: p.priceAmount,
          pricePerSqm: p.pricePerSqm,
          builtAreaSqm: p.builtAreaSqm,
          usableAreaSqm: null,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          areaLabel: p.areaLabel,
          environmentType: p.environmentType,
          commuteMin: p.commuteMin,
          beachProximity: p.beachProximity,
          parkProximity: p.parkProximity,
          condition: null,
          energyRating: null,
          hasOutdoorSpace: null,
          accessibilityFeature: null,
          lastConfirmedAvailableAt: p.lastConfirmedAvailableAt,
        });
      }
      const scores = scoreComparisonSet(facts, weights);
      setComparison({
        disclaimerKey: 'suitability_not_valuation',
        listings: facts.map((f, i) => ({
          listingId: f.listingId,
          title: titles[f.listingId] ?? f.listingId,
          cells: {
            askingPrice:
              f.priceAmount != null
                ? { status: 'available', value: f.priceAmount }
                : { status: 'unavailable', reason: 'not_in_source' },
            pricePerSqm:
              f.pricePerSqm != null
                ? { status: 'available', value: f.pricePerSqm }
                : { status: 'unavailable', reason: 'not_in_source' },
            bedrooms:
              f.bedrooms != null
                ? { status: 'available', value: f.bedrooms }
                : { status: 'unavailable', reason: 'not_in_source' },
            bathrooms:
              f.bathrooms != null
                ? { status: 'available', value: f.bathrooms }
                : { status: 'unavailable', reason: 'not_in_source' },
            builtAreaSqm:
              f.builtAreaSqm != null
                ? { status: 'available', value: f.builtAreaSqm }
                : { status: 'unavailable', reason: 'not_in_source' },
            usableAreaSqm: { status: 'unavailable', reason: 'not_in_source' },
            location:
              f.areaLabel != null
                ? { status: 'available', value: f.areaLabel }
                : { status: 'unavailable', reason: 'not_in_source' },
            environmentType:
              f.environmentType != null
                ? { status: 'available', value: f.environmentType }
                : { status: 'unavailable', reason: 'not_in_source' },
            commuteMin:
              f.commuteMin != null
                ? { status: 'available', value: f.commuteMin }
                : { status: 'unavailable', reason: 'not_in_source' },
            energyRating: { status: 'unavailable', reason: 'not_in_source' },
            condition: { status: 'unavailable', reason: 'not_in_source' },
          },
          score: scores[i],
        })),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (listingIds.length >= 2) void runCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveWeights() {
    const ok = await hasSession();
    if (!ok) return;
    await fetch('/api/v1/me/preference-profiles', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weights }),
    });
    await runCompare();
  }

  const fieldKeys = [
    'askingPrice',
    'pricePerSqm',
    'bedrooms',
    'bathrooms',
    'builtAreaSqm',
    'usableAreaSqm',
    'location',
    'environmentType',
    'commuteMin',
    'energyRating',
    'condition',
  ];

  return (
    <div data-testid="comparison-page">
      <p>
        <Link href={`/${locale}/workspace/shortlists`}>{labels.shortlists}</Link>
      </p>
      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      <section aria-labelledby="weights-heading">
        <h2 id="weights-heading">{labels.weights}</h2>
        <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 420 }}>
          {COMPARISON_WEIGHT_KEYS.map((key) => (
            <label
              key={key}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}
            >
              <span>{key}</span>
              <input
                type="number"
                min={0}
                max={10}
                data-testid={`weight-${key}`}
                value={weights[key] ?? 0}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, [key]: Number.parseInt(e.target.value, 10) || 0 }))
                }
                aria-label={key}
              />
            </label>
          ))}
        </div>
        <button type="button" data-testid="save-weights" onClick={() => void saveWeights()}>
          {labels.saveWeights}
        </button>
        <button type="button" data-testid="run-compare" onClick={() => void runCompare()}>
          {labels.compare}
        </button>
      </section>

      <p
        role="note"
        data-testid="score-disclaimer"
        style={{ marginTop: '1rem', fontSize: '0.9rem' }}
      >
        {labels.disclaimer}
      </p>

      {loading && <p>{labels.loading}</p>}

      {comparison && (
        <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
          <table data-testid="comparison-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                {comparison.listings.map((l) => (
                  <th key={l.listingId} scope="col">
                    {l.title}
                    <div data-testid={`score-${l.listingId}`}>
                      {labels.score}: {l.score?.score == null ? labels.noScore : l.score.score}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fieldKeys.map((field) => (
                <tr key={field}>
                  <th scope="row">{field}</th>
                  {comparison.listings.map((l) => {
                    const cell = l.cells[field];
                    return (
                      <td key={l.listingId}>
                        {cell?.status === 'available' ? String(cell.value) : labels.unavailable}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {comparison.listings.map((l) => (
            <details key={l.listingId} data-testid={`explanation-${l.listingId}`}>
              <summary>
                {labels.explanation}: {l.title}
              </summary>
              <ul>
                {(l.score?.factors ?? []).map((f) => (
                  <li key={f.key}>
                    {f.key}: weight {f.weight}, fact {f.factScore.toFixed(2)}, contribution{' '}
                    {f.contribution.toFixed(2)}
                  </li>
                ))}
              </ul>
              {(l.score?.missing?.length ?? 0) > 0 && (
                <p>
                  {labels.missing}: {l.score!.missing.join(', ')}
                </p>
              )}
            </details>
          ))}
        </div>
      )}

      <ComparisonSharePanel
        locale={locale}
        listingIds={listingIds}
        labels={labels}
        weights={weights}
      />
    </div>
  );
}

type OwnerShareRow = {
  id: string;
  status: string;
  expiresAt: string;
  publicTitle: string | null;
  listingIds?: string[];
};

function ComparisonSharePanel({
  locale,
  listingIds,
  labels,
  weights,
}: {
  locale: string;
  listingIds: string[];
  labels: Labels;
  weights: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [selected, setSelected] = useState<string[]>(listingIds);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiryPreset, setExpiryPreset] = useState<'24h' | '7d' | '30d'>('7d');
  const [includeScores, setIncludeScores] = useState(false);
  const [includeWeights, setIncludeWeights] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [shares, setShares] = useState<OwnerShareRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    void hasSession().then(setSignedIn);
  }, []);

  useEffect(() => {
    setSelected(listingIds);
  }, [listingIds]);

  async function refreshShares() {
    const res = await fetch('/api/v1/me/comparison-shares', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = (await res.json()) as { items: OwnerShareRow[] };
    setShares(data.items ?? []);
  }

  useEffect(() => {
    if (signedIn) void refreshShares();
  }, [signedIn]);

  async function createShare() {
    if (selected.length < 2) {
      setShareError(labels.error);
      return;
    }
    setBusy(true);
    setShareError(null);
    try {
      const res = await fetch('/api/v1/me/comparison-shares', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          listingIds: selected,
          publicTitle: title || null,
          publicDescription: description || null,
          expiryPreset,
          includeScores,
          includeWeights,
          weights: includeScores || includeWeights ? weights : undefined,
          locale,
        }),
      });
      if (!res.ok) {
        setShareError(labels.error);
        return;
      }
      const data = (await res.json()) as { publicUrl: string };
      setPublicUrl(data.publicUrl);
      await refreshShares();
    } finally {
      setBusy(false);
    }
  }

  async function revokeShare(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/v1/me/comparison-shares/${id}/revoke`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      await refreshShares();
    } finally {
      setBusy(false);
    }
  }

  if (listingIds.length < 2) return null;

  return (
    <section style={{ marginTop: '2rem' }} aria-labelledby="share-heading">
      <h2 id="share-heading">{labels.shareComparison}</h2>
      {!signedIn ? (
        <p>{labels.shareSignInRequired}</p>
      ) : (
        <>
          <button type="button" data-testid="open-share-dialog" onClick={() => setOpen((v) => !v)}>
            {labels.shareComparison}
          </button>
          {open && (
            <div data-testid="share-dialog" style={{ marginTop: '1rem', maxWidth: 520 }}>
              {shareError && (
                <p role="alert" style={{ color: 'crimson' }}>
                  {shareError}
                </p>
              )}
              <fieldset>
                <legend>{labels.items}</legend>
                {listingIds.map((id) => (
                  <label key={id} style={{ display: 'block' }}>
                    <input
                      type="checkbox"
                      data-testid={`share-listing-${id}`}
                      checked={selected.includes(id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
                        )
                      }
                    />{' '}
                    {id.slice(0, 8)}…
                  </label>
                ))}
              </fieldset>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                {labels.shareTitle}
                <input
                  data-testid="share-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                {labels.shareDescription}
                <textarea
                  data-testid="share-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                />
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                {labels.shareExpiry}
                <select
                  data-testid="share-expiry"
                  value={expiryPreset}
                  onChange={(e) => setExpiryPreset(e.target.value as '24h' | '7d' | '30d')}
                >
                  <option value="24h">{labels.expiry24h}</option>
                  <option value="7d">{labels.expiry7d}</option>
                  <option value="30d">{labels.expiry30d}</option>
                </select>
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  data-testid="share-include-scores"
                  checked={includeScores}
                  onChange={(e) => setIncludeScores(e.target.checked)}
                />{' '}
                {labels.includeScores}
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  data-testid="share-include-weights"
                  checked={includeWeights}
                  onChange={(e) => setIncludeWeights(e.target.checked)}
                />{' '}
                {labels.includeWeights}
              </label>
              <button
                type="button"
                data-testid="create-share"
                disabled={busy}
                onClick={() => void createShare()}
                style={{ marginTop: '0.75rem' }}
              >
                {labels.createShare}
              </button>
              {publicUrl && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p>{labels.shareCreated}</p>
                  <input
                    data-testid="share-link"
                    readOnly
                    value={publicUrl}
                    style={{ width: '100%' }}
                  />
                  <button
                    type="button"
                    data-testid="copy-share-link"
                    onClick={() => void navigator.clipboard.writeText(publicUrl)}
                  >
                    {labels.copyLink}
                  </button>
                </div>
              )}
            </div>
          )}
          <div data-testid="share-list" style={{ marginTop: '1.5rem' }}>
            <h3>{labels.shareList}</h3>
            <ul>
              {shares.map((s) => (
                <li key={s.id}>
                  <span>
                    {s.publicTitle ?? s.id.slice(0, 8)} — {s.status}
                  </span>{' '}
                  {s.status === 'active' && (
                    <button
                      type="button"
                      data-testid={`revoke-share-${s.id}`}
                      onClick={() => void revokeShare(s.id)}
                    >
                      {labels.revokeShare}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
