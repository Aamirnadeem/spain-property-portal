import { LocalStorageProvider } from './local';
import type { StorageProvider } from './provider';
import { StorageConfigurationError } from './provider';
import { SupabaseStorageProvider } from './supabase';

export function createStorageProvider(env: NodeJS.ProcessEnv = process.env): StorageProvider {
  const provider = env.STORAGE_PROVIDER ?? 'local';

  if (env.NODE_ENV === 'production' && provider !== 'supabase') {
    throw new StorageConfigurationError('Production storage must use Supabase Storage');
  }
  if (provider === 'local') {
    return new LocalStorageProvider(env.STORAGE_LOCAL_PATH);
  }
  if (provider === 'supabase') {
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = env.SUPABASE_STORAGE_BUCKET;
    if (!url || !serviceRoleKey || !bucket) {
      throw new StorageConfigurationError(
        'Supabase Storage requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET',
      );
    }
    return new SupabaseStorageProvider({
      url,
      serviceRoleKey,
      bucket,
    });
  }

  throw new StorageConfigurationError(`Unsupported STORAGE_PROVIDER: ${provider}`);
}
