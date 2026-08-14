import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

const PHYSICAL_TO_READING_RELATIVE: Record<string, string> = { left: 'start', right: 'end' };

/**
 * v10 → v11: rewrites each sheet's `typographyConfig.textAlign` from a
 * screen side to a reading-relative one. Every stored project predates
 * right-to-left support and was therefore laid out left to right, so `left`
 * is exactly the reading start and `right` the reading end — the rewrite
 * preserves how each project already looks.
 *
 * `alignmentConfig` is deliberately untouched: where the caption block sits
 * is composition against the video frame, so it stays in screen terms.
 *
 * Values that are already relative, absent, or unrecognised are left alone;
 * the deserializer fills anything missing from the typography defaults.
 */
export class ProjectV10ToV11Migration implements ProjectMigration {
  readonly fromVersion = 10;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    if (!Array.isArray(data.sheets)) return data;
    return { ...data, sheets: data.sheets.map((sheet) => this.migrateSheet(sheet)) };
  }

  private migrateSheet(sheet: unknown): unknown {
    if (!this.isRecord(sheet)) return sheet;
    const typography = sheet.typographyConfig;
    if (!this.isRecord(typography)) return sheet;
    const migratedTypography = this.migrateTextAlign(typography);
    if (migratedTypography === typography) return sheet;
    return { ...sheet, typographyConfig: migratedTypography };
  }

  private migrateTextAlign(typography: Record<string, unknown>): Record<string, unknown> {
    const textAlign = typography.textAlign;
    if (typeof textAlign !== 'string') return typography;
    const migrated = PHYSICAL_TO_READING_RELATIVE[textAlign];
    if (migrated === undefined) return typography;
    return { ...typography, textAlign: migrated };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
