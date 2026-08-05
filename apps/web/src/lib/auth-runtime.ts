import { createAuthProvider, OtpAbuseError } from '@spain/communications';
import { logger } from '@spain/observability';

/** The only auth entry point used by the web application. */
export const authProvider = createAuthProvider();

export function mapOtpError(err: unknown) {
  if (err instanceof OtpAbuseError) {
    logger.warn('otp_abuse', { code: err.code, message: err.message });
    return { status: 429 as const, error: err.code };
  }
  logger.error('otp_unexpected', { err: String(err) });
  return { status: 500 as const, error: 'server_error' };
}
