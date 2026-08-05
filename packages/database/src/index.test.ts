import { describe, expect, it } from 'vitest';
import { implementedRlsPolicies, rlsEnabledTables } from './rls/policies';
import * as schema from './schema/index';

describe('phase 1+2 schema', () => {
  it('exports identity, geography and inventory tables', () => {
    expect(schema.users).toBeTruthy();
    expect(schema.guestSessions).toBeTruthy();
    expect(schema.propertyListings).toBeTruthy();
    expect(schema.physicalProperties).toBeTruthy();
    expect(schema.favourites).toBeTruthy();
    expect(schema.dataSources).toBeTruthy();
    expect(schema.importRuns).toBeTruthy();
  });
});

describe('RLS policy catalogue', () => {
  it('enables RLS on sensitive tables', () => {
    expect(rlsEnabledTables).toContain('users');
    expect(rlsEnabledTables).toContain('guest_sessions');
    expect(rlsEnabledTables).toContain('user_consents');
    expect(rlsEnabledTables).toContain('property_listings');
    expect(rlsEnabledTables).toContain('favourites');
  });

  it('defines self-access and public browse policies', () => {
    expect(implementedRlsPolicies).toContain('users_self_select');
    expect(implementedRlsPolicies).toContain('guest_sessions_by_hash_select');
    expect(implementedRlsPolicies).toContain('user_consents_self_all');
    expect(implementedRlsPolicies).toContain('property_listings_public_browse');
    expect(implementedRlsPolicies).toContain('favourites_owner_select');
  });
});
