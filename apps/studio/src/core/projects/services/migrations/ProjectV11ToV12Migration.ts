import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/**
 * What happens to one stored control value.
 *
 * `to` may name more than one id: a single control that drove two
 * separate things becomes two, and both inherit the stored value so the
 * sheet keeps rendering as it did. An empty `to` drops the value.
 *
 * `factor` and `max` convert a number whose meaning changed, not just
 * its name. Non-numeric values pass through untouched.
 */
interface ControlRewrite {
  readonly to: readonly string[];
  readonly factor?: number;
  readonly max?: number;
}

const DROPPED: ControlRewrite = { to: [] };

/**
 * Per template, what each retired control id becomes. Ids absent from a
 * template's entry are already canonical and are copied across as-is.
 *
 * The three `factor` entries are all the ratio between the new default
 * and the old one, which preserves how far the user had pushed the dial
 * away from the authored look. For loki and naya that ratio is also
 * derivable from the geometry, and both agree: loki's entrance scaled
 * `1 - 0.4 * intensity` and now scales `1 - 0.04 * intensity`, naya's
 * pop scaled `1 + word-pop` and now scales `1 + 0.1 * intensity`. freya
 * cannot be checked that way — its aberration moved from a raw pixel
 * offset to `em`, and how many pixels an em was depends on the render
 * size, which is exactly the bug the move fixed — so the ratio is the
 * only anchor it has.
 */
const REWRITES: Record<string, Record<string, ControlRewrite>> = {
  cleo: {
    'shadow-blur': { to: ['shadow-blur'], max: 2 },
    'slide-distance': DROPPED,
  },
  elio: {
    'reveal-distance': DROPPED,
  },
  freya: {
    'text-color': { to: ['primary-color'] },
    'aberration-color-a': { to: ['split-color-a'] },
    'aberration-color-b': { to: ['split-color-b'] },
    'aberration-amount': { to: ['split-x'], factor: 0.025, max: 0.6 },
  },
  iris: {
    'bg-padding-x': { to: ['mask-padding-x'] },
    'bg-padding-y': { to: ['mask-padding-y'] },
    'stroke-offset-y': { to: ['mask-offset-y'] },
    'shadow-color': { to: ['outline-color'] },
  },
  kai: {
    'chroma-a': { to: ['split-color-a'] },
    'chroma-b': { to: ['split-color-b'] },
    'edge-size': { to: ['outline-thickness'] },
  },
  kel: {
    'active-bg-color': { to: ['highlight-bg-color'] },
  },
  lena: {
    'bubble-color': { to: ['bg-color'] },
    'bubble-padding-x': { to: ['bg-padding-x'] },
    'bubble-padding-y': { to: ['bg-padding-y'] },
    'bubble-radius': { to: ['bg-radius'] },
  },
  levi: {
    'reveal-distance': DROPPED,
  },
  loki: {
    'shadow-color': { to: ['outline-color', 'shadow-color'] },
    'shadow-distance': { to: ['filter-shadow-distance'] },
    'shadow-blur': { to: ['filter-shadow-blur'] },
    'animation-intensity': { to: ['animation-intensity'], factor: 10, max: 2 },
  },
  mira: {
    'slide-distance': DROPPED,
  },
  naya: {
    'shadow-color': { to: ['outline-color'] },
    'word-pop': { to: ['animation-intensity'], factor: 10, max: 2 },
  },
  noor: {
    'fade-start': DROPPED,
    'slide-distance': DROPPED,
  },
  nyx: {
    'show-cursor': { to: ['show-caret'] },
  },
  pepper: {
    'bg-padding-x': { to: ['highlight-bg-padding-x'] },
    'bg-padding-y': { to: ['highlight-bg-padding-y'] },
    'bg-radius': { to: ['highlight-bg-radius'] },
  },
  remi: {
    'snap-rise': DROPPED,
    'snap-rotation': DROPPED,
    'snap-scale': DROPPED,
  },
  selene: {
    'text-color': { to: ['primary-color'] },
  },
  vera: {
    'highlight-color': { to: ['highlight-bg-color'] },
    'highlight-padding-x': { to: ['highlight-bg-padding-x'] },
    'highlight-padding-y': { to: ['highlight-bg-padding-y'] },
    'highlight-radius': { to: ['highlight-bg-radius'] },
  },
  zara: {
    'stroke-color-a': { to: ['split-color-a'] },
    'stroke-color-b': { to: ['split-color-b'] },
    'stroke-offset': { to: ['split-x'] },
  },
};

/**
 * v11 → v12: rewrites each sheet's `styleValues` keys onto the
 * canonical style-control vocabulary.
 *
 * A stored key that no longer matches a control the template declares
 * is never read — the sheet renders the template's authored default and
 * the user's tuning is gone without a word. Renaming the keys is what
 * keeps a saved project looking the way it was left.
 *
 * A sheet whose `templateId` is not in the table, or that carries a
 * user template, is untouched: only the built-in templates were
 * renamed, and a value already stored under a canonical id is the same
 * value either way.
 *
 * Three controls retire with no successor because several dials folded
 * into one (`animation-intensity` now owns the strength of an entrance
 * that used to expose its distance, its rotation and its fade
 * separately). Many-to-one cannot be inverted, so those values are
 * dropped and the new dial takes its default, which is the look the
 * template's author chose.
 *
 * A sheet carrying a CSS or filter override keeps its numbers unscaled.
 * The override is the sheet's own CSS, frozen when the user edited it,
 * so it still holds the arithmetic the old control fed: loki's entrance
 * multiplied its intensity by `0.4` where the template now multiplies by
 * `0.04`. Scaling the value while that coefficient is still in force
 * would apply the change twice. Renames still run — a key nobody reads
 * costs nothing either way.
 */
export class ProjectV11ToV12Migration implements ProjectMigration {
  readonly fromVersion = 11;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    if (!Array.isArray(data.sheets)) return data;
    return { ...data, sheets: data.sheets.map((sheet) => this.migrateSheet(sheet)) };
  }

  private migrateSheet(sheet: unknown): unknown {
    if (!this.isRecord(sheet)) return sheet;
    if (typeof sheet.templateId !== 'string') return sheet;
    const rewrites = REWRITES[sheet.templateId];
    if (rewrites === undefined) return sheet;
    if (!this.isRecord(sheet.styleValues)) return sheet;
    const values = this.rewriteValues(sheet.styleValues, rewrites, this.hasOwnCss(sheet));
    return { ...sheet, styleValues: values };
  }

  private hasOwnCss(sheet: Record<string, unknown>): boolean {
    return typeof sheet.cssOverride === 'string' || typeof sheet.filtersSvgOverride === 'string';
  }

  private rewriteValues(
    styleValues: Record<string, unknown>,
    rewrites: Record<string, ControlRewrite>,
    keepNumbers: boolean,
  ): Record<string, unknown> {
    const migrated: Record<string, unknown> = {};
    for (const [id, value] of Object.entries(styleValues)) {
      const rewrite = rewrites[id];
      if (rewrite === undefined) {
        migrated[id] = value;
        continue;
      }
      for (const target of rewrite.to) {
        migrated[target] = keepNumbers ? value : this.convert(value, rewrite);
      }
    }
    return migrated;
  }

  private convert(value: unknown, rewrite: ControlRewrite): unknown {
    if (typeof value !== 'number' || !Number.isFinite(value)) return value;
    const scaled = value * (rewrite.factor ?? 1);
    return rewrite.max === undefined ? scaled : Math.min(scaled, rewrite.max);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
