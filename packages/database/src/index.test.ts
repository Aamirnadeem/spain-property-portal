import { describe, expect, it } from 'vitest';
import { expectedRlsTables, rlsPolicyStatements } from './rls/policies';
import * as schema from './schema/index';

describe('phase 1 schema', () => {
  it('exports identity and geography tables', () => {
    expect(schema.users).toBeTruthy();
    expect(schema.guestSessions).toBeTruthy();
    expect(schema.authIdentities).toBeTruthy();
    expect(schema.organizations).toBeTruthy();
    expect(schema.countries).toBeTruthy();
    expect(schema.autonomousCommunities).toBeTruthy();
    expect(schema.mediaAssets).toBeTruthy();
    expect(schema.callSessions).toBeTruthy();
  });
});

describe('RLS policy catalogue', () => {
  it('enables RLS on sensitive tables', () => {
    for (const table of expectedRlsTables) {
      expect(
        rlsPolicyStatements.some((s) =>
          s.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`),
        ),
      ).toBe(true);
    }
  });

  it('defines self-access policies for users and consents', () => {
    expect(rlsPolicyStatements.some((s) => s.includes('users_self_select'))).toBe(true);
    expect(rlsPolicyStatements.some((s) => s.includes('consents_self'))).toBe(true);
    expect(rlsPolicyStatements.some((s) => s.includes('countries_public_read'))).toBe(true);
  });
});
