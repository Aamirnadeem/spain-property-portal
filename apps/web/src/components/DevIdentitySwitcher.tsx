'use client';

import { useEffect, useState } from 'react';
import { DEMO_IDENTITIES, readSpainUserId, setSpainUserId } from '@/lib/demo-identities';

export function DevIdentitySwitcher({
  labels,
  onChange,
}: {
  labels: {
    signedInAs: string;
    notSignedIn: string;
    orgOwner: string;
    orgAgent: string;
    platformAdmin: string;
    listingReviewer: string;
  };
  onChange?: (userId: string) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(readSpainUserId());
  }, []);

  function pick(id: string) {
    setSpainUserId(id);
    setUserId(id);
    onChange?.(id);
  }

  const labelFor: Record<(typeof DEMO_IDENTITIES)[number]['labelKey'], string> = {
    orgOwner: labels.orgOwner,
    orgAgent: labels.orgAgent,
    platformAdmin: labels.platformAdmin,
    listingReviewer: labels.listingReviewer,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        border: '1px dashed hsl(var(--border))',
        borderRadius: 'var(--radius)',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
      }}
      data-testid="dev-identity-switcher"
    >
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>
        {userId ? `${labels.signedInAs}: ${userId}` : labels.notSignedIn}
      </span>
      {DEMO_IDENTITIES.map((identity) => (
        <button
          key={identity.id}
          type="button"
          onClick={() => pick(identity.id)}
          data-testid={`dev-identity-${identity.labelKey}`}
          style={{
            fontSize: '0.8rem',
            padding: '0.25rem 0.6rem',
            borderRadius: 999,
            border: '1px solid hsl(var(--border))',
            background: userId === identity.id ? 'hsl(var(--primary))' : 'transparent',
            color: userId === identity.id ? 'hsl(var(--primary-foreground))' : 'inherit',
            cursor: 'pointer',
          }}
        >
          {labelFor[identity.labelKey]}
        </button>
      ))}
    </div>
  );
}
