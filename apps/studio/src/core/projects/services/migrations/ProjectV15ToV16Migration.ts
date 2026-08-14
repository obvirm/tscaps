import { ELEMENT_KINDS, type ElementKind } from '@core/elements/domain/ElementKind';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';

/** One element's stored style at v15: an entrance recorded on its own, and the CSS it never reached. */
interface StoredStyleV15 {
  readonly kind?: unknown;
  readonly entrance?: unknown;
  readonly css?: unknown;
}

/**
 * v15 → v16: writes each element's entrance into the element's own CSS.
 *
 * The entrance used to be recorded and nowhere else: the CSS it produces
 * was generated at the last moment, every time the stylesheet was
 * assembled, and never reached the text the user edits. Picking one
 * changed nothing they could see in the code editor, which read as an
 * editor showing them half of what renders.
 *
 * The block goes in ahead of whatever the element already carried, which
 * is where it was being emitted all along — so nothing moves on screen,
 * and what was written by hand keeps winning by coming after.
 *
 * An entrance the library no longer offers writes nothing and the record
 * is left alone: it produced no CSS before this step either, so the
 * element renders exactly as it did. The record itself is left where it
 * was, for the step after this one to move.
 *
 * The payload is read field by field rather than through the store's own
 * reader, because the store keeps moving and this step does not: read
 * through it, the day `entrance` stopped being a field was the day every
 * v15 project silently lost its animations on load. The writer is the
 * one thing borrowed from production — spelling those declarations by
 * hand would write text the editor would not recognise as its own.
 */
export class ProjectV15ToV16Migration implements ProjectMigration {
  readonly fromVersion = 15;

  constructor(private readonly animationCssWriter: ElementAnimationCssWriter) {}

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const stored = data.elementStyles;
    if (stored === null || typeof stored !== 'object') return { ...data };

    const styles: Record<string, unknown> = {};
    for (const [elementId, style] of Object.entries(stored as Record<string, StoredStyleV15>)) {
      styles[elementId] = this.withEntranceWritten(style);
    }
    return { ...data, elementStyles: styles };
  }

  private withEntranceWritten(style: StoredStyleV15): unknown {
    const kind = this.readKind(style.kind);
    const entrance = this.readEntrance(style.entrance);
    if (kind === null || entrance === null) return style;
    const css = typeof style.css === 'string' ? style.css : '';
    return {
      ...style,
      css: this.animationCssWriter.rewrite(css, kind, ElementAnimationScope.SELF, undefined, entrance),
    };
  }

  private readKind(value: unknown): ElementKind | null {
    return (ELEMENT_KINDS as ReadonlyArray<string>).includes(value as string) ? value as ElementKind : null;
  }

  private readEntrance(value: unknown): ElementAnimation | null {
    if (value === null || typeof value !== 'object') return null;
    const { presetId, params } = value as Partial<ElementAnimation>;
    if (presetId !== null && typeof presetId !== 'string') return null;
    return { presetId, params: params ?? {} };
  }
}
