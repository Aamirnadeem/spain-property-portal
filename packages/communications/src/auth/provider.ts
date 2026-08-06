import type { OtpChannel } from '../types';

export interface AuthUser {
  /** Persistent provider user ID. Supabase Auth UUID in production. */
  id: string;
  email?: string;
  mobile?: string;
}

export interface RequestOtpInput {
  channel: OtpChannel;
  destination: string;
  ip?: string;
}

export interface RequestOtpResult {
  challengeId: string;
  cooldownSeconds?: number;
  /** Present only from FakeAuthProvider in development/test. */
  devCode?: string;
}

export interface VerifyOtpInput {
  challengeId: string;
  code: string;
}

/** Optional provider-managed tokens (Supabase) returned alongside the verified user. */
export interface ProviderSessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

export interface AuthVerifyResult {
  user: AuthUser;
  providerSession?: ProviderSessionTokens;
}

export interface AuthProvider {
  readonly name: 'fake' | 'supabase';
  readonly persistent: boolean;
  requestOtp(input: RequestOtpInput): Promise<RequestOtpResult>;
  verifyOtp(input: VerifyOtpInput): Promise<AuthVerifyResult>;
}

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export interface AuthRuntimeConfig {
  nodeEnv?: string;
  otpProvider?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  allowHeaderAuth?: string;
}

export function readAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
  return {
    nodeEnv: env.NODE_ENV,
    otpProvider: env.OTP_PROVIDER,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    allowHeaderAuth: env.ALLOW_HEADER_AUTH,
  };
}

export function assertAuthRuntimeSafety(config: AuthRuntimeConfig): void {
  if (config.nodeEnv !== 'production') return;

  if (!config.otpProvider) {
    throw new AuthConfigurationError('OTP_PROVIDER is required in production');
  }
  if (config.otpProvider === 'fake') {
    throw new AuthConfigurationError('FakeAuthProvider is forbidden in production');
  }
  if (config.otpProvider !== 'supabase') {
    throw new AuthConfigurationError(`Unsupported production OTP_PROVIDER: ${config.otpProvider}`);
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new AuthConfigurationError(
      'Supabase URL and anonymous key are required for production authentication',
    );
  }
  if (config.allowHeaderAuth === 'true') {
    throw new AuthConfigurationError('ALLOW_HEADER_AUTH is forbidden in production');
  }
}

/**
 * Temporary local/test escape hatch for `x-user-id` / client `spain_user_id`.
 * Forbidden in production even if set; requires FakeAuth.
 */
export function isHeaderAuthAllowed(config: AuthRuntimeConfig = readAuthRuntimeConfig()): boolean {
  if (config.nodeEnv === 'production') return false;
  if (config.nodeEnv !== 'development' && config.nodeEnv !== 'test') return false;
  if (config.otpProvider !== 'fake') return false;
  return config.allowHeaderAuth === 'true';
}

/** DevIdentitySwitcher / fake session minting — development or test + FakeAuth only. */
export function isFakeDevAuthUiAllowed(
  config: AuthRuntimeConfig = readAuthRuntimeConfig(),
): boolean {
  if (config.nodeEnv !== 'development' && config.nodeEnv !== 'test') return false;
  return (config.otpProvider ?? 'fake') === 'fake';
}

export function canExposeDevCode(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}
