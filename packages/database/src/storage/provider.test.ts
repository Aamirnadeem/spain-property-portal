import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStorageProvider } from './factory';
import { LocalStorageProvider } from './local';
import { StorageConfigurationError } from './provider';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('storage providers', () => {
  it('stores and deletes bytes through LocalStorageProvider', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spain-storage-'));
    roots.push(root);
    const provider = new LocalStorageProvider(root);

    const stored = await provider.putObject({
      bytes: new TextEncoder().encode('authorized fixture'),
      contentType: 'text/plain',
      prefix: 'tests',
    });
    expect(provider.persistent).toBe(false);
    expect(await readFile(join(root, stored.storageKey), 'utf8')).toBe('authorized fixture');

    await provider.deleteObject(stored.storageKey);
    await expect(readFile(join(root, stored.storageKey))).rejects.toThrow();
  });

  it('forbids local storage in production', () => {
    expect(() =>
      createStorageProvider({
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'local',
      }),
    ).toThrow(StorageConfigurationError);
  });

  it('gates Supabase Storage on complete configuration', () => {
    expect(() =>
      createStorageProvider({
        NODE_ENV: 'development',
        STORAGE_PROVIDER: 'supabase',
      }),
    ).toThrow(StorageConfigurationError);
  });
});
