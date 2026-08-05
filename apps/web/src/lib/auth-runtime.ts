import {
  InMemoryOtpStore,
  createFakeEmailAdapter,
  createFakeSmsAdapter,
  OtpAbuseError,
} from '@spain/communications';
import { logger } from '@spain/observability';

/** Process-local stores for Phase 1 fake auth (replaced by DB-backed store when Supabase Auth is wired). */
export const otpStore = new InMemoryOtpStore();
export const emailAdapter = createFakeEmailAdapter();
export const smsAdapter = createFakeSmsAdapter();

export type VerifiedUserRecord = {
  userId: string;
  email?: string;
  mobile?: string;
};

const usersByDestination = new Map<string, VerifiedUserRecord>();

export function upsertUserFromIdentity(
  channel: 'email' | 'sms',
  destination: string,
): VerifiedUserRecord {
  const existing = usersByDestination.get(`${channel}:${destination}`);
  if (existing) return existing;
  const user: VerifiedUserRecord = {
    userId: crypto.randomUUID(),
    email: channel === 'email' ? destination : undefined,
    mobile: channel === 'sms' ? destination : undefined,
  };
  usersByDestination.set(`${channel}:${destination}`, user);
  return user;
}

export function mapOtpError(err: unknown) {
  if (err instanceof OtpAbuseError) {
    logger.warn('otp_abuse', { code: err.code, message: err.message });
    return { status: 429 as const, error: err.code };
  }
  logger.error('otp_unexpected', { err: String(err) });
  return { status: 500 as const, error: 'server_error' };
}
