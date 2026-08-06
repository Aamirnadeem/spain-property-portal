'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { hasSession } from '@/lib/guest-phase4b';

type NotificationItem = {
  id: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  payload: Record<string, unknown>;
  listingId: string | null;
  savedSearchId: string | null;
  readAt: string | null;
  createdAt: string;
};

function resolveLabel(labels: Record<string, string>, key: string, fallback: string): string {
  return labels[key] ?? labels[key.replace(/^notifications\./, '')] ?? fallback;
}

export function WorkspaceNotificationsClient({
  locale,
  labels,
  notificationLabels,
}: {
  locale: string;
  labels: Record<string, string>;
  notificationLabels: Record<string, { title?: string; body?: string } | string>;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const titleFor = useCallback(
    (item: NotificationItem) => {
      const typeKey = item.type;
      const fromNested = notificationLabels[typeKey];
      if (fromNested && typeof fromNested === 'object' && fromNested.title) {
        return fromNested.title;
      }
      return resolveLabel(labels, item.titleKey, item.type);
    },
    [labels, notificationLabels],
  );

  const bodyFor = useCallback(
    (item: NotificationItem) => {
      const typeKey = item.type;
      const fromNested = notificationLabels[typeKey];
      if (fromNested && typeof fromNested === 'object' && fromNested.body) {
        return fromNested.body;
      }
      return resolveLabel(labels, item.bodyKey, '');
    },
    [labels, notificationLabels],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await hasSession();
      setSignedIn(ok);
      if (!ok) {
        setItems([]);
        setUnread(0);
        return;
      }
      const res = await fetch('/api/v1/me/notifications', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { items: NotificationItem[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    const res = await fetch(`/api/v1/me/notifications/${id}/read`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      setError(labels.error);
      return;
    }
    await load();
  }

  async function markAllRead() {
    const res = await fetch('/api/v1/me/notifications/read-all', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      setError(labels.error);
      return;
    }
    await load();
  }

  async function dismiss(id: string) {
    const res = await fetch(`/api/v1/me/notifications/${id}/dismiss`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      setError(labels.error);
      return;
    }
    await load();
  }

  if (loading) return <p>{labels.loading}</p>;

  return (
    <div data-testid="workspace-notifications">
      {!signedIn ? (
        <p className="banner" role="status">
          {labels.signInBanner} <Link href={`/${locale}/account`}>{labels.signInBanner}</Link>
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}

      {signedIn ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <span aria-live="polite">
            {labels.unread}: {unread}
          </span>
          <button
            type="button"
            data-testid="mark-all-read"
            disabled={unread === 0}
            onClick={() => void markAllRead()}
          >
            {labels.markAllRead}
          </button>
        </div>
      ) : null}

      {!signedIn || items.length === 0 ? (
        <p>{labels.emptyNotifications}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map((item) => {
            const unreadItem = !item.readAt;
            return (
              <li
                key={item.id}
                data-testid="notification-item"
                data-read={unreadItem ? 'false' : 'true'}
                style={{
                  borderBottom: '1px solid hsl(var(--border))',
                  padding: '0.75rem 0',
                  opacity: unreadItem ? 1 : 0.75,
                }}
              >
                <div style={{ fontWeight: unreadItem ? 600 : 400 }}>{titleFor(item)}</div>
                {bodyFor(item) ? (
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>{bodyFor(item)}</p>
                ) : null}
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                  {new Date(item.createdAt).toLocaleString(locale)}
                </div>
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}
                >
                  {item.listingId ? (
                    <Link
                      data-testid="notification-link"
                      href={`/${locale}/properties/${item.listingId}`}
                    >
                      {labels.openProperty ?? 'View property'}
                    </Link>
                  ) : null}
                  {item.savedSearchId ? (
                    <Link href={`/${locale}/workspace/searches/${item.savedSearchId}`}>
                      {labels.searches}
                    </Link>
                  ) : null}
                  {unreadItem ? (
                    <button
                      type="button"
                      data-testid="mark-read"
                      onClick={() => void markRead(item.id)}
                    >
                      {labels.markRead}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void dismiss(item.id)}>
                    {labels.dismiss}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
