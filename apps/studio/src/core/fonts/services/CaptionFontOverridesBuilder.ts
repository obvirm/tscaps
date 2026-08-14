import type { Document, ScopedRenderOverride, Segment } from '@tscaps/engine';
import { ElementRenderOverrides } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { SegmentFontStylesBuilder } from '@core/fonts/services/SegmentFontStylesBuilder';

/** Font declarations to layer over a render's own overrides, keyed by sheet id. */
export interface CaptionFontOverrides {
  readonly wordsBySheet: Readonly<Record<string, ElementRenderOverrides>>;
  readonly segmentsBySheet: Readonly<Record<string, ElementRenderOverrides>>;
}

/**
 * Derives every font-family declaration a render needs beyond the sheet
 * wrapper, as one self-contained artifact: the resolved font variable for
 * segments whose font is overridden, and the per-word declarations for
 * words in a script their surroundings don't share. The caller layers the
 * result over its own overrides; nothing else about the render changes.
 *
 * What each element declares is decided one segment at a time by the same
 * collaborator the preview asks, so a whole document renders the way the
 * segment under the playhead already looked.
 */
export class CaptionFontOverridesBuilder {

  constructor(private readonly segmentFontStylesBuilder: SegmentFontStylesBuilder) {}

  build(doc: Document, sheets: ReadonlyArray<Sheet>, elementStyles: ElementStyles): CaptionFontOverrides {
    const sheetsById = new Map<string, Sheet>(sheets.map((sheet) => [sheet.id, sheet]));
    const wordsBySheet: Record<string, ElementRenderOverrides> = {};
    const segmentsBySheet: Record<string, ElementRenderOverrides> = {};
    for (const section of doc.sections) {
      const sheet = sheetsById.get(section.kind);
      if (!sheet) continue;
      const wordEntries: Array<readonly [string, ScopedRenderOverride]> = [];
      const segmentEntries: Array<readonly [string, ScopedRenderOverride]> = [];
      for (const segment of section.segments) {
        this.collectSegment(sheet, segment, elementStyles, wordEntries, segmentEntries);
      }
      if (wordEntries.length > 0) wordsBySheet[sheet.id] = ElementRenderOverrides.fromEntries(wordEntries);
      if (segmentEntries.length > 0) segmentsBySheet[sheet.id] = ElementRenderOverrides.fromEntries(segmentEntries);
    }
    return { wordsBySheet, segmentsBySheet };
  }

  private collectSegment(
    sheet: Sheet,
    segment: Segment,
    elementStyles: ElementStyles,
    wordEntries: Array<readonly [string, ScopedRenderOverride]>,
    segmentEntries: Array<readonly [string, ScopedRenderOverride]>,
  ): void {
    const segmentVars = this.segmentFontStylesBuilder.buildSegmentFontVars(sheet, segment, elementStyles);
    if (Object.keys(segmentVars).length > 0) {
      segmentEntries.push([segment.id, { inlineStyles: { ...segmentVars } }]);
    }
    const wordFamilies = this.segmentFontStylesBuilder.buildWordFontFamilies(sheet, segment, elementStyles);
    for (const [wordId, fontFamily] of wordFamilies) {
      wordEntries.push([wordId, { inlineStyles: { 'font-family': fontFamily } }]);
    }
  }
}
