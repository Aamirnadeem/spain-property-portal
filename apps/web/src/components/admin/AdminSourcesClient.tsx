'use client';

import { useEffect, useState } from 'react';
import { readSpainUserId } from '@/lib/demo-identities';

const PERMISSION_STATUSES = ['pending', 'approved', 'restricted', 'suspended', 'expired'] as const;
const IMAGE_RIGHTS = ['none', 'hotlink_only', 'display', 'download_and_transform'] as const;

interface DataSourceRow {
  id: string;
  sourceKey: string;
  name: string;
  sourceType: string;
  permissionStatus: string;
  imageRights: string;
  permissionExpiresAt: string | null;
}

type Labels = {
  sourcesTitle: string;
  permissionStatus: string;
  imageRights: string;
  updatePermission: string;
};

export function AdminSourcesClient({ labels }: { labels: Labels }) {
  const [items, setItems] = useState<DataSourceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: string; rights: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const userId = readSpainUserId();
    if (!userId) {
      setError('not_signed_in');
      return;
    }
    const res = await fetch('/api/v1/admin/sources', { headers: { 'x-user-id': userId } });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? 'load_failed');
      return;
    }
    const data = await res.json();
    const rows: DataSourceRow[] = data.items ?? [];
    setItems(rows);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.id]) next[row.id] = { status: row.permissionStatus, rights: row.imageRights };
      }
      return next;
    });
    setError(null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function update(sourceId: string) {
    const userId = readSpainUserId();
    const draft = drafts[sourceId];
    if (!userId || !draft) return;
    setBusyId(sourceId);
    await fetch(`/api/v1/admin/sources/${sourceId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({ toStatus: draft.status, toImageRights: draft.rights }),
    });
    setBusyId(null);
    await load();
  }

  return (
    <section data-testid="admin-sources">
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{labels.sourcesTitle}</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      <div className="table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>{labels.permissionStatus}</th>
              <th>{labels.imageRights}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((source) => (
              <tr key={source.id} data-testid={`admin-source-row-${source.sourceKey}`}>
                <td>
                  {source.name}
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                    {source.sourceKey}
                  </div>
                </td>
                <td>
                  <select
                    value={drafts[source.id]?.status ?? source.permissionStatus}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [source.id]: {
                          ...d[source.id],
                          status: e.target.value,
                          rights: d[source.id]?.rights ?? source.imageRights,
                        },
                      }))
                    }
                  >
                    {PERMISSION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={drafts[source.id]?.rights ?? source.imageRights}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [source.id]: {
                          status: d[source.id]?.status ?? source.permissionStatus,
                          rights: e.target.value,
                        },
                      }))
                    }
                  >
                    {IMAGE_RIGHTS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    disabled={busyId === source.id}
                    onClick={() => update(source.id)}
                    data-testid={`admin-update-source-${source.sourceKey}`}
                  >
                    {labels.updatePermission}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
