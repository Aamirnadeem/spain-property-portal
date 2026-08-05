/** Normative gate from docs/SOURCE_PERMISSION_MODEL.md — jobs must refuse to run otherwise. */
export const LEGACY_SNAPSHOT_SOURCE_KEY = 'legacy-barcelona-explorer-60';

export class SourceNotRunnableError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'SourceNotRunnableError';
  }
}

export interface RunnableSourceCheck {
  sourceKey: string;
  permissionStatus: string;
  permissionExpiresAt: Date | null;
}

export function assertSourceRunnable(
  source: RunnableSourceCheck,
  options: { legacySnapshotMode?: boolean } = {},
): void {
  const legacyException =
    source.sourceKey === LEGACY_SNAPSHOT_SOURCE_KEY && options.legacySnapshotMode;
  if (legacyException) return;

  if (source.permissionStatus !== 'approved') {
    throw new SourceNotRunnableError(
      `Source is not approved to run imports (status: ${source.permissionStatus})`,
      `source_permission_${source.permissionStatus}`,
    );
  }
  if (source.permissionExpiresAt && source.permissionExpiresAt.getTime() < Date.now()) {
    throw new SourceNotRunnableError('Source permission has expired', 'source_permission_expired');
  }
}
