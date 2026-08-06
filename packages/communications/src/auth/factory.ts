import { createFakeEmailAdapter } from '../email/fake';
import { createFakeSmsAdapter } from '../sms/fake';
import { FakeAuthProvider } from './fake';
import {
  assertAuthRuntimeSafety,
  AuthConfigurationError,
  readAuthRuntimeConfig,
  type AuthProvider,
} from './provider';
import { SupabaseAuthProvider } from './supabase';

export function createAuthProvider(env: NodeJS.ProcessEnv = process.env): AuthProvider {
  const config = readAuthRuntimeConfig(env);
  assertAuthRuntimeSafety(config);
  const provider = config.otpProvider ?? 'fake';

  if (provider === 'fake') {
    return new FakeAuthProvider({
      emailAdapter: createFakeEmailAdapter(),
      smsAdapter: createFakeSmsAdapter(),
      nodeEnv: config.nodeEnv,
    });
  }
  if (provider === 'supabase') {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new AuthConfigurationError(
        'Supabase Auth requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
      );
    }
    return new SupabaseAuthProvider({
      url: config.supabaseUrl,
      anonKey: config.supabaseAnonKey,
    });
  }

  throw new AuthConfigurationError(`Unsupported OTP_PROVIDER: ${provider}`);
}
