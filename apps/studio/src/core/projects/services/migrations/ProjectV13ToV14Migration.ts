import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { ProjectMigration } from '@core/projects/services/migrations/ProjectMigration';
import type { StoredCaptionElement, StoredCaptionElementScanner } from '@core/projects/services/migrations/StoredCaptionElementScanner';
import type { StoredTypographyReader } from '@core/projects/services/migrations/StoredTypographyReader';

const PLACEMENT_KEYS = ['verticalAlign', 'verticalOffset', 'horizontalAlign', 'horizontalOffset'];

/**
 * v13 → v14: moves how an element looks out of the word and segment
 * overrides and into the element's own style, leaving only where it
 * sits behind.
 *
 * There is one place an element's look is decided now, and it is the
 * element's own record and CSS. Two records writing the same properties
 * meant the one that landed inline won whatever the other said, so a
 * word could carry two sizes and show neither of the two the panels
 * offered.
 *
 * Every moved value is written the way the editor writes it, record and
 * declaration together, so a migrated field opens on the number it was
 * left at rather than reporting itself overruled by CSS it wrote
 * itself. A value whose element the kind does not offer a field for is
 * dropped: it was never reaching the screen.
 */
export class ProjectV13ToV14Migration implements ProjectMigration {
  readonly fromVersion = 13;

  constructor(
    private readonly scanner: StoredCaptionElementScanner,
    private readonly typographyReader: StoredTypographyReader,
    private readonly catalog: StyledElementCatalog,
    private readonly cssWriter: ElementControlCssWriter,
  ) {}

  migrate(data: Record<string, unknown>): Record<string, unknown> {
    const wordOverrides = this.recordAt(data, 'wordStyleOverrides');
    const segmentOverrides = this.recordAt(data, 'segmentOverrides');
    const segmentStyle = this.recordAt(segmentOverrides ?? {}, 'style');
    if (!wordOverrides && !segmentStyle) return data;

    let styles = ElementStyles.fromSnapshot((data.elementStyles ?? {}) as never);
    for (const element of this.scanner.scan(data)) {
      const stored = this.storedFor(element, wordOverrides, segmentStyle);
      if (!stored) continue;
      styles = this.moveTypography(styles, element, stored);
    }

    return {
      ...data,
      elementStyles: styles.toSnapshot(),
      ...(wordOverrides ? { wordStyleOverrides: this.placementsOnly(wordOverrides) } : {}),
      ...(segmentOverrides ? { segmentOverrides: this.withPlacementsOnly(segmentOverrides, segmentStyle) } : {}),
    };
  }

  private storedFor(
    element: StoredCaptionElement,
    wordOverrides: Record<string, unknown> | null,
    segmentStyle: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    const source = element.kind === 'segment' ? segmentStyle : wordOverrides;
    return this.recordAt(source ?? {}, element.id);
  }

  private moveTypography(
    styles: ElementStyles,
    element: StoredCaptionElement,
    stored: Record<string, unknown>,
  ): ElementStyles {
    let next = styles;
    for (const [fieldId, value] of this.typographyReader.read(element, stored)) {
      const control = this.catalog.controlFor(element.kind, fieldId);
      if (!control) continue;
      const css = this.cssWriter.write(next.get(element.id)?.css ?? '', control, value);
      next = next.withField(element.id, element.kind, control.id, value, css);
    }
    return next;
  }

  private withPlacementsOnly(
    segmentOverrides: Record<string, unknown>,
    segmentStyle: Record<string, unknown> | null,
  ): Record<string, unknown> {
    if (!segmentStyle) return segmentOverrides;
    const style = this.placementsOnly(segmentStyle);
    const { style: _replaced, ...rest } = segmentOverrides;
    return Object.keys(style).length > 0 ? { ...rest, style } : rest;
  }

  private placementsOnly(overrides: Record<string, unknown>): Record<string, unknown> {
    const kept: Record<string, unknown> = {};
    for (const [id, stored] of Object.entries(overrides)) {
      const placement = this.placementOf(stored);
      if (placement) kept[id] = placement;
    }
    return kept;
  }

  private placementOf(stored: unknown): Record<string, unknown> | null {
    if (typeof stored !== 'object' || stored === null) return null;
    const held = stored as Record<string, unknown>;
    const placement: Record<string, unknown> = {};
    for (const key of PLACEMENT_KEYS) {
      if (held[key] !== undefined) placement[key] = held[key];
    }
    return Object.keys(placement).length > 0 ? placement : null;
  }

  private recordAt(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const held = value[key];
    if (typeof held !== 'object' || held === null || Array.isArray(held)) return null;
    return held as Record<string, unknown>;
  }
}
