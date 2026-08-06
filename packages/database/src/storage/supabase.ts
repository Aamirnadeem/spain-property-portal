import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PutObjectInput, StorageProvider, StoredObject } from './provider';
import { StorageConfigurationError } from './provider';

export interface SupabaseStorageProviderOptions {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  client?: SupabaseClient;
}

/**
 * Server-only production adapter. The service role key must never reach a
 * browser bundle. Media authorization is enforced before this adapter is used.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase' as const;
  readonly persistent = true;
  private readonly client: SupabaseClient;

  constructor(private readonly options: SupabaseStorageProviderOptions) {
    if (!options.url || !options.serviceRoleKey || !options.bucket) {
      throw new StorageConfigurationError(
        'Supabase Storage requires URL, service role key, and bucket',
      );
    }
    this.client =
      options.client ??
      createClient(options.url, options.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const prefix = (input.prefix ?? new Date().toISOString().slice(0, 10))
      .replace(/[^a-zA-Z0-9/_-]/g, '')
      .replace(/^\/+|\/+$/g, '');
    const storageKey = `${prefix}/${randomUUID()}`;
    const { error } = await this.client.storage
      .from(this.options.bucket)
      .upload(storageKey, input.bytes, {
        contentType: input.contentType,
        upsert: false,
      });
    if (error) throw error;

    return {
      storageKey,
      size: input.bytes.byteLength,
      contentType: input.contentType,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const { error } = await this.client.storage.from(this.options.bucket).remove([storageKey]);
    if (error) throw error;
  }

  async createSignedReadUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.options.bucket)
      .createSignedUrl(storageKey, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  }
}
