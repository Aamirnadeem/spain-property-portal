import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PutObjectInput, StorageProvider, StoredObject } from './provider';

export interface LocalUploadResult {
  storageKey: string;
  absolutePath: string;
}

function resolveStoragePath(root: string, storageKey: string): string {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, normalize(storageKey));
  if (
    absolutePath !== absoluteRoot &&
    !absolutePath.startsWith(`${absoluteRoot}\\`) &&
    !absolutePath.startsWith(`${absoluteRoot}/`)
  ) {
    throw new Error('Invalid storage key');
  }
  return absolutePath;
}

/**
 * Non-production storage for local development and tests.
 * Files are process-host local and are not durable across ephemeral deployments.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  readonly persistent = false;

  constructor(private readonly root = process.env.STORAGE_LOCAL_PATH ?? './.data/uploads') {}

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const date = new Date().toISOString().slice(0, 10);
    const safePrefix = (input.prefix ?? date).replace(/[^a-zA-Z0-9/_-]/g, '');
    const storageKey = `${safePrefix}/${randomUUID()}`;
    const absolutePath = resolveStoragePath(this.root, storageKey);
    await mkdir(resolveStoragePath(this.root, safePrefix), {
      recursive: true,
    });
    await writeFile(absolutePath, input.bytes);
    return {
      storageKey,
      size: input.bytes.byteLength,
      contentType: input.contentType,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    await rm(resolveStoragePath(this.root, storageKey), { force: true });
  }

  async createSignedReadUrl(storageKey: string, _expiresInSeconds: number): Promise<string> {
    resolveStoragePath(this.root, storageKey);
    return `/api/v1/media/local/${encodeURIComponent(storageKey)}`;
  }
}

/**
 * Phase 1 local storage foundation — signed cloud uploads come later with credentials.
 */
export async function storeLocalUpload(
  bytes: Buffer,
  contentType: string,
  root = process.env.STORAGE_LOCAL_PATH ?? './.data/uploads',
): Promise<LocalUploadResult> {
  const provider = new LocalStorageProvider(root);
  const result = await provider.putObject({ bytes, contentType });
  const storageKey = result.storageKey;
  const absolutePath = join(root, storageKey);
  return { storageKey, absolutePath };
}

export function buildSignedUploadPlaceholder(storageKey: string) {
  return {
    storageKey,
    method: 'PUT' as const,
    url: `/api/v1/media/local-upload?key=${encodeURIComponent(storageKey)}`,
    headers: { 'content-type': 'application/octet-stream' },
    note: 'Local placeholder — replace with signed Supabase/S3 URL when credentials exist',
  };
}
