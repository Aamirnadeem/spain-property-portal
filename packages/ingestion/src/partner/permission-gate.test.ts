import { describe, expect, it } from 'vitest';
import { assertSourceRunnable, SourceNotRunnableError } from './permission-gate';

describe('assertSourceRunnable', () => {
  it('allows an approved, non-expired source', () => {
    expect(() =>
      assertSourceRunnable({
        sourceKey: 'partner-csv-demo-catalonia',
        permissionStatus: 'approved',
        permissionExpiresAt: null,
      }),
    ).not.toThrow();
  });

  it.each(['pending', 'restricted', 'suspended', 'expired'])(
    'denies a %s source',
    (permissionStatus) => {
      expect(() =>
        assertSourceRunnable({
          sourceKey: 'partner-csv-generic',
          permissionStatus,
          permissionExpiresAt: null,
        }),
      ).toThrow(SourceNotRunnableError);
    },
  );

  it('denies an approved source past its permission_expires_at', () => {
    expect(() =>
      assertSourceRunnable({
        sourceKey: 'partner-csv-demo-catalonia',
        permissionStatus: 'approved',
        permissionExpiresAt: new Date(Date.now() - 1000),
      }),
    ).toThrow(/expired/);
  });

  it('allows the legacy snapshot source only in legacy_snapshot mode', () => {
    const source = {
      sourceKey: 'legacy-barcelona-explorer-60',
      permissionStatus: 'restricted',
      permissionExpiresAt: null,
    };
    expect(() => assertSourceRunnable(source, { legacySnapshotMode: true })).not.toThrow();
    expect(() => assertSourceRunnable(source, { legacySnapshotMode: false })).toThrow();
  });
});
