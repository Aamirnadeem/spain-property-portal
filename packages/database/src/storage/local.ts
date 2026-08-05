import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface LocalUploadResult {
  storageKey: string;
  absolutePath: string;
}

/**
 * Phase 1 local storage foundation — signed cloud uploads come later with credentials.
 */
export async function storeLocalUpload(
  bytes: Buffer,
  contentType: string,
  root = process.env.STORAGE_LOCAL_PATH ?? './.data/uploads',
): Promise<LocalUploadResult> {
  const storageKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
  const absolutePath = join(root, storageKey);
  await mkdir(join(root, storageKey.split('/')[0]!), { recursive: true });
  await writeFile(absolutePath, bytes);
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
