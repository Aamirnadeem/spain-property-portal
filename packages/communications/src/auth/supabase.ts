import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AuthProvider,
  AuthUser,
  AuthVerifyResult,
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
} from './provider';
import { AuthConfigurationError } from './provider';

interface SupabaseChallenge {
  channel: 'email' | 'sms';
  destination: string;
}

function encodeChallenge(challenge: SupabaseChallenge): string {
  return encodeURIComponent(JSON.stringify(challenge));
}

function decodeChallenge(challengeId: string): SupabaseChallenge {
  try {
    const value = JSON.parse(decodeURIComponent(challengeId)) as SupabaseChallenge;
    if ((value.channel !== 'email' && value.channel !== 'sms') || !value.destination) {
      throw new Error('invalid challenge');
    }
    return value;
  } catch {
    throw new Error('Invalid Supabase OTP challenge');
  }
}

export interface SupabaseAuthProviderOptions {
  url: string;
  anonKey: string;
  client?: SupabaseClient;
}

/** Production adapter. Supabase owns OTP delivery, verification, and user IDs. */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = 'supabase' as const;
  readonly persistent = true;
  private readonly client: SupabaseClient;

  constructor(options: SupabaseAuthProviderOptions) {
    if (!options.url || !options.anonKey) {
      throw new AuthConfigurationError('Supabase Auth requires URL and anonymous key');
    }
    this.client =
      options.client ??
      createClient(options.url, options.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
  }

  async requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
    const credentials =
      input.channel === 'email' ? { email: input.destination } : { phone: input.destination };
    const { error } = await this.client.auth.signInWithOtp(credentials);
    if (error) throw error;

    return {
      challengeId: encodeChallenge({
        channel: input.channel,
        destination: input.destination,
      }),
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<AuthVerifyResult> {
    const challenge = decodeChallenge(input.challengeId);
    const result =
      challenge.channel === 'email'
        ? await this.client.auth.verifyOtp({
            email: challenge.destination,
            token: input.code,
            type: 'email',
          })
        : await this.client.auth.verifyOtp({
            phone: challenge.destination,
            token: input.code,
            type: 'sms',
          });

    if (result.error) throw result.error;
    if (!result.data.user) {
      throw new Error('Supabase OTP verification returned no user');
    }

    const user = {
      id: result.data.user.id,
      email: result.data.user.email,
      mobile: result.data.user.phone,
    };
    const session = result.data.session;
    if (!session?.access_token || !session.refresh_token) {
      return { user };
    }
    return {
      user,
      providerSession: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
      },
    };
  }

  /** Validate an access token from a cookie-backed Supabase session. */
  async getUserFromAccessToken(accessToken: string): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      mobile: data.user.phone,
    };
  }
}
