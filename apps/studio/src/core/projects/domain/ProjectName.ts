/**
 * Domain rules for a project's display name. The name shows up in the
 * dashboard, the editor toolbar, exported filenames and the persisted
 * row. The maximum length is a hard cap enforced on every write path
 * so the value that leaves the client is guaranteed to fit the
 * server-side validation.
 */
export class ProjectName {
  private static readonly MAX_LENGTH = 50;
  private static readonly FALLBACK = 'Untitled';

  get maxLength(): number {
    return ProjectName.MAX_LENGTH;
  }

  /**
   * Normalises a raw name into a persistable one. Trims whitespace,
   * truncates to the maximum length, and falls back to a placeholder
   * when the result is empty. Deliberately silent: an oversized
   * filename or an all-whitespace rename lands as a sensible default
   * instead of being rejected.
   */
  clamp(raw: string): string {
    const trimmed = raw.trim().slice(0, ProjectName.MAX_LENGTH);
    return trimmed.length > 0 ? trimmed : ProjectName.FALLBACK;
  }
}
