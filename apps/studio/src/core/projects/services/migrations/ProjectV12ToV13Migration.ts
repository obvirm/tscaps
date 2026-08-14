import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * v12 → v13: lifts the structurally-edited segment ids out of
 * `segmentOverrides.frozenIds` into a top-level
 * `structurallyEditedSegmentIds` array.
 *
 * The ids moved because they were never an override of how a segment
 * renders — they record that the user split, merged or retyped a scene,
 * which is one of the reasons a segment is excluded from reflow rather
 * than a style. Style overrides are the other reason and stay where
 * they are, so nothing about which segments end up excluded changes.
 */
export class ProjectV12ToV13Migration implements ProjectMigration {
  readonly fromVersion = 12;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const overrides = this.readSegmentOverrides(data);
    if (!overrides || !('frozenIds' in overrides)) return data;

    const { frozenIds, ...rest } = overrides;
    const ids = Array.isArray(frozenIds)
      ? frozenIds.filter((id): id is string => typeof id === 'string')
      : [];

    return {
      ...data,
      segmentOverrides: rest,
      ...(ids.length > 0 ? { structurallyEditedSegmentIds: ids } : {}),
    };
  }

  private readSegmentOverrides(data: Record<string, unknown>): Record<string, unknown> | null {
    const overrides = data.segmentOverrides;
    if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) return null;
    return overrides as Record<string, unknown>;
  }
}
