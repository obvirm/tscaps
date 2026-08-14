import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/** One element's stored style at v16, where the single animation it could hold was its entrance. */
interface StoredStyleV16 {
  readonly entrance?: unknown;
}

/**
 * v16 → v17: files each element's entrance under the part of the element
 * it animates.
 *
 * An element used to hold one animation, so nothing had to say what that
 * animation moved. A caption can now be told how the words inside it
 * arrive as well as how it does, and two answers need two places to sit.
 * The one already recorded moves to the element itself, which is what it
 * always was.
 *
 * Nothing is rewritten in the CSS: the block that entrance wrote is
 * already in the element's own text, and it is the same block the
 * element's own scope builds. What changes is only where the record
 * naming it sits.
 */
export class ProjectV16ToV17Migration implements ProjectMigration {
  readonly fromVersion = 16;

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const stored = data.elementStyles;
    if (stored === null || typeof stored !== 'object') return { ...data };

    const styles: Record<string, unknown> = {};
    for (const [elementId, style] of Object.entries(stored as Record<string, StoredStyleV16>)) {
      styles[elementId] = this.withEntranceFiled(style);
    }
    return { ...data, elementStyles: styles };
  }

  private withEntranceFiled(style: StoredStyleV16): unknown {
    const { entrance, ...rest } = style;
    if (entrance === null || typeof entrance !== 'object') return rest;
    return { ...rest, animations: { [ElementAnimationScope.SELF]: entrance } };
  }
}
