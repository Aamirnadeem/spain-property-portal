import { describe, expect, it } from 'vitest';
import {
  assertAuthRuntimeSafety,
  isFakeDevAuthUiAllowed,
  isHeaderAuthAllowed,
} from '@spain/communications';
import { canMutateOrgInventory, canReadOrgInventory } from '@spain/database';
import { assertSameOrigin } from './csrf';

describe('Phase 3.1 authz helpers', () => {
  it('maps org roles to read/mutate capabilities', () => {
    expect(canReadOrgInventory('org_viewer')).toBe(true);
    expect(canMutateOrgInventory('org_viewer')).toBe(false);
    expect(canMutateOrgInventory('org_agent')).toBe(true);
    expect(canMutateOrgInventory('org_owner')).toBe(true);
    expect(canMutateOrgInventory('org_admin')).toBe(true);
  });

  it('rejects header auth and fake provider in production config', () => {
    expect(() =>
      assertAuthRuntimeSafety({
        nodeEnv: 'production',
        otpProvider: 'fake',
        supabaseUrl: 'https://x.supabase.co',
        supabaseAnonKey: 'k',
      }),
    ).toThrow(/FakeAuthProvider/);
    expect(() =>
      assertAuthRuntimeSafety({
        nodeEnv: 'production',
        otpProvider: 'supabase',
        supabaseUrl: 'https://x.supabase.co',
        supabaseAnonKey: 'k',
        allowHeaderAuth: 'true',
      }),
    ).toThrow(/ALLOW_HEADER_AUTH/);
    expect(
      isHeaderAuthAllowed({
        nodeEnv: 'production',
        otpProvider: 'fake',
        allowHeaderAuth: 'true',
      }),
    ).toBe(false);
  });

  it('allows header auth only for local fake + explicit flag', () => {
    expect(
      isHeaderAuthAllowed({
        nodeEnv: 'development',
        otpProvider: 'fake',
        allowHeaderAuth: 'true',
      }),
    ).toBe(true);
    expect(
      isHeaderAuthAllowed({
        nodeEnv: 'development',
        otpProvider: 'fake',
        allowHeaderAuth: undefined,
      }),
    ).toBe(false);
    expect(isFakeDevAuthUiAllowed({ nodeEnv: 'development', otpProvider: 'fake' })).toBe(true);
    expect(isFakeDevAuthUiAllowed({ nodeEnv: 'production', otpProvider: 'supabase' })).toBe(false);
  });

  it('rejects disallowed Origin on mutating requests', () => {
    const req = new Request('http://localhost:3000/api/v1/partner/listings', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    const res = assertSameOrigin(req);
    expect(res?.status).toBe(403);
  });

  it('allows same-origin mutating requests', () => {
    const req = new Request('http://localhost:3000/api/v1/partner/listings', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it('derives the allowed origin from the request itself, not a fixed port', () => {
    const sameOrigin = new Request('http://127.0.0.1:3100/api/v1/auth/logout', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3100' },
    });
    expect(assertSameOrigin(sameOrigin)).toBeNull();

    const otherPort = new Request('http://127.0.0.1:3100/api/v1/auth/logout', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000' },
    });
    expect(assertSameOrigin(otherPort)?.status).toBe(403);
  });

  it('honours a proxied public origin and forwarded host', () => {
    const req = new Request('http://internal-app:8080/api/v1/partner/listings', {
      method: 'POST',
      headers: {
        origin: 'https://app.example.com',
        'x-forwarded-host': 'app.example.com',
        'x-forwarded-proto': 'https',
      },
    });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it('allows non-browser clients that send neither Origin nor Referer', () => {
    const req = new Request('http://127.0.0.1:3100/api/v1/auth/logout', { method: 'POST' });
    expect(assertSameOrigin(req)).toBeNull();
  });
});
