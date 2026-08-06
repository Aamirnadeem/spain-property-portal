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
    expect(schema.shortlists).toBeTruthy();
    expect(schema.propertyNotes).toBeTruthy();
    expect(schema.comparisonSets).toBeTruthy();
    expect(schema.dataSources).toBeTruthy();
    expect(schema.importRuns).toBeTruthy();
  });
});

describe('phase 4B schema', () => {
  it('exports saved search, browsing history and notification tables', () => {
    expect(schema.savedSearches).toBeTruthy();
    expect(schema.savedSearchEvaluationRuns).toBeTruthy();
    expect(schema.savedSearchLastMatches).toBeTruthy();
    expect(schema.browsingHistory).toBeTruthy();
    expect(schema.inAppNotifications).toBeTruthy();
    expect(schema.notificationDeliveries).toBeTruthy();
    expect(schema.notificationPreferences).toBeTruthy();
  });
});

describe('phase 4C schema', () => {
  it('exports secure comparison share tables', () => {
    expect(schema.comparisonShares).toBeTruthy();
    expect(schema.comparisonShareItems).toBeTruthy();
    expect(schema.comparisonShareAccessEvents).toBeTruthy();
  });
});

describe('RLS policy catalogue', () => {
  it('enables RLS on sensitive tables', () => {
    expect(rlsEnabledTables).toContain('users');
    expect(rlsEnabledTables).toContain('guest_sessions');
    expect(rlsEnabledTables).toContain('user_consents');
    expect(rlsEnabledTables).toContain('property_listings');
    expect(rlsEnabledTables).toContain('favourites');
    expect(rlsEnabledTables).toContain('shortlists');
    expect(rlsEnabledTables).toContain('property_notes');
  });

  it('enables RLS on phase 4B buyer tables (0009/0010)', () => {
    expect(rlsEnabledTables).toContain('saved_searches');
    expect(rlsEnabledTables).toContain('saved_search_evaluation_runs');
    expect(rlsEnabledTables).toContain('saved_search_last_matches');
    expect(rlsEnabledTables).toContain('browsing_history');
    expect(rlsEnabledTables).toContain('in_app_notifications');
    expect(rlsEnabledTables).toContain('notification_deliveries');
  });

  it('defines self-access and public browse policies', () => {
    expect(implementedRlsPolicies).toContain('users_self_select');
    expect(implementedRlsPolicies).toContain('guest_sessions_by_hash_select');
    expect(implementedRlsPolicies).toContain('user_consents_self_all');
    expect(implementedRlsPolicies).toContain('property_listings_public_browse');
    expect(implementedRlsPolicies).toContain('favourites_owner_select');
    expect(implementedRlsPolicies).toContain('shortlists_owner_select');
    expect(implementedRlsPolicies).toContain('property_notes_owner_select');
  });

  it('defines owner-only policies for phase 4B tables with no agency access', () => {
    expect(implementedRlsPolicies).toContain('saved_searches_owner_select');
    expect(implementedRlsPolicies).toContain('saved_searches_owner_insert');
    expect(implementedRlsPolicies).toContain('saved_searches_owner_update');
    expect(implementedRlsPolicies).toContain('saved_searches_owner_delete');
    expect(implementedRlsPolicies).toContain('saved_search_evaluation_runs_owner_select');
    expect(implementedRlsPolicies).toContain('saved_search_last_matches_owner_select');
    expect(implementedRlsPolicies).toContain('browsing_history_owner_select');
    expect(implementedRlsPolicies).toContain('browsing_history_owner_insert');
    expect(implementedRlsPolicies).toContain('browsing_history_owner_delete');
    expect(implementedRlsPolicies).toContain('in_app_notifications_owner_select');
    expect(implementedRlsPolicies).toContain('in_app_notifications_owner_update');
    expect(implementedRlsPolicies).toContain('notification_deliveries_owner_select');
    // No agency/organization-scoped policy name exists for any phase 4B table.
    for (const policy of implementedRlsPolicies) {
      const isPhase4bTable = [
        'saved_searches',
        'saved_search_evaluation_runs',
        'saved_search_last_matches',
        'browsing_history',
        'in_app_notifications',
        'notification_deliveries',
      ].some((t) => policy.startsWith(t));
      if (isPhase4bTable) {
        expect(policy).not.toContain('org_');
        expect(policy).not.toContain('admin_');
      }
    }
  });

  it('defines owner-only Phase 4C policies with no anon policy', () => {
    expect(rlsEnabledTables).toContain('comparison_shares');
    expect(rlsEnabledTables).toContain('comparison_share_items');
    expect(rlsEnabledTables).toContain('comparison_share_access_events');
    expect(implementedRlsPolicies).toContain('comparison_shares_owner_select');
    expect(implementedRlsPolicies).toContain('comparison_share_items_owner_insert');
    expect(implementedRlsPolicies).toContain('comparison_share_access_events_owner_select');
    expect(
      implementedRlsPolicies.some(
        (policy) => policy.includes('comparison_share') && policy.includes('anon'),
      ),
    ).toBe(false);
  });
});
