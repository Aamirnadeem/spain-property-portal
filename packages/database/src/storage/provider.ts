export interface StoredObject {
  storageKey: string;
  size: number;
  contentType: string;
}

export interface PutObjectInput {
  bytes: Uint8Array;
  contentType: string;
  prefix?: string;
}

export interface StorageProvider {
  readonly name: 'local' | 'supabase';
  readonly persistent: boolean;
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(storageKey: string): Promise<void>;
  createSignedReadUrl(storageKey: string, expiresInSeconds: number): Promise<string>;
}

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}
