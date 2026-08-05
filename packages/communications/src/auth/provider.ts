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

export interface AuthProvider {
  readonly name: 'fake' | 'supabase';
  readonly persistent: boolean;
  requestOtp(input: RequestOtpInput): Promise<RequestOtpResult>;
  verifyOtp(input: VerifyOtpInput): Promise<AuthUser>;
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
}

export function readAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
  return {
    nodeEnv: env.NODE_ENV,
    otpProvider: env.OTP_PROVIDER,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
}

export function canExposeDevCode(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}
