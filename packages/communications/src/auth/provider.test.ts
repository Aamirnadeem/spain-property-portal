import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeEmailAdapter } from '../email/fake';
import { createFakeSmsAdapter } from '../sms/fake';
import { FakeAuthProvider } from './fake';
import { assertAuthRuntimeSafety, AuthConfigurationError, canExposeDevCode } from './provider';

describe('production auth safety', () => {
  it.each([
    {
      nodeEnv: 'production',
      otpProvider: undefined,
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
    },
    {
      nodeEnv: 'production',
      otpProvider: 'fake',
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
    },
    {
      nodeEnv: 'production',
      otpProvider: 'supabase',
      supabaseUrl: undefined,
      supabaseAnonKey: undefined,
    },
  ])('fails closed for unsafe config %#', (config) => {
    expect(() => assertAuthRuntimeSafety(config)).toThrow(AuthConfigurationError);
  });

  it('accepts complete Supabase production configuration', () => {
    expect(() =>
      assertAuthRuntimeSafety({
        nodeEnv: 'production',
        otpProvider: 'supabase',
        supabaseUrl: 'https://project.supabase.co',
        supabaseAnonKey: 'anon-key',
      }),
    ).not.toThrow();
  });

  it('never exposes dev codes outside development and test', () => {
    expect(canExposeDevCode('development')).toBe(true);
    expect(canExposeDevCode('test')).toBe(true);
    expect(canExposeDevCode('production')).toBe(false);
    expect(canExposeDevCode('staging')).toBe(false);
  });
});

describe('FakeAuthProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns a stable process-local user ID and does not log the code', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const provider = new FakeAuthProvider({
      emailAdapter: createFakeEmailAdapter(),
      smsAdapter: createFakeSmsAdapter(),
      nodeEnv: 'test',
    });
    const issued = await provider.requestOtp({
      channel: 'email',
      destination: 'buyer@example.com',
      ip: '127.0.0.1',
    });
    expect(issued.devCode).toMatch(/^\d{6}$/);
    expect(log.mock.calls.flat().join(' ')).not.toContain(issued.devCode);

    const first = await provider.verifyOtp({
      challengeId: issued.challengeId,
      code: issued.devCode!,
    });
    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(provider.persistent).toBe(false);
  });

  it('cannot be created in production', () => {
    expect(
      () =>
        new FakeAuthProvider({
          emailAdapter: createFakeEmailAdapter(),
          smsAdapter: createFakeSmsAdapter(),
          nodeEnv: 'production',
        }),
    ).toThrow(/only run in development or test/);
  });
});
