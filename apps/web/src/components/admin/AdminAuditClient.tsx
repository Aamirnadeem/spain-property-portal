'use client';

import { useEffect, useState } from 'react';

interface AuditEventRow {
  id: string;
  actorUserId: string | null;
  organizationId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

type Labels = {
  auditTitle: string;
  action: string;
  entity: string;
  actor: string;
  when: string;
  auditEmpty: string;
};

export function AdminAuditClient({ labels }: { labels: Labels }) {
  const [items, setItems] = useState<AuditEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/v1/admin/audit', { credentials: 'same-origin' });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? 'load_failed');
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    })();
  }, []);

  return (
    <section data-testid="admin-audit">
      <h1 style={{ fontFamily: 'var(--font-serif)' }}>{labels.auditTitle}</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {items.length === 0 && !error ? (
        <p>{labels.auditEmpty}</p>
      ) : (
        <div className="table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>{labels.when}</th>
                <th>{labels.action}</th>
                <th>{labels.entity}</th>
                <th>{labels.actor}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => (
                <tr key={event.id} data-testid={`admin-audit-row-${event.id}`}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.action}</td>
                  <td>
                    {event.entityType} {event.entityId ? `(${event.entityId.slice(0, 8)}…)` : ''}
                  </td>
                  <td>{event.actorUserId ? `${event.actorUserId.slice(0, 8)}…` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
