import type { Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { CaptionFontFamilyResolver } from '@core/fonts/services/CaptionFontFamilyResolver';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

const NO_VARS: Readonly<Record<string, string>> = {};

/**
 * Derives the font-family declarations one segment needs so every element's
 * stack is led by the face that draws its own text: the resolved font
 * variable of a segment whose font is overridden, and the per-word
 * declarations of words written in a script their surroundings don't share.
 *
 * One segment at a time, in the shape both render paths can consume, so
 * preview and export reach the same answer for the same segment instead of
 * each deciding on its own and drifting apart unnoticed.
 */
export class SegmentFontStylesBuilder {

  constructor(private readonly captionFontFamilyResolver: CaptionFontFamilyResolver) {}

  /**
   * Font variable overriding the segment's chosen family with its
   * resolved stack. Empty when the segment was never given a font.
   * Spread after the segment's own inline styles so the resolved value
   * wins.
   */
  buildSegmentFontVars(sheet: Sheet, segment: Segment, elementStyles: ElementStyles): Readonly<Record<string, string>> {
    const family = elementStyles.fieldText(segment.id, ElementFieldId.FONT_FAMILY);
    if (family === null) return NO_VARS;
    const stack = this.captionFontFamilyResolver.segmentOverrideStack(family, sheet.textScript);
    return { [TemplateCssVariable.FONT_FAMILY]: stack };
  }

  /** Per-word `font-family` values keyed by word id. Words that inherit are absent. */
  buildWordFontFamilies(sheet: Sheet, segment: Segment, elementStyles: ElementStyles): ReadonlyMap<string, string> {
    const inherited = this.captionFontFamilyResolver.inheritedContext(
      sheet.typographyConfig.fontFamily,
      elementStyles.fieldText(segment.id, ElementFieldId.FONT_FAMILY),
      sheet.textScript,
    );
    const out = new Map<string, string>();
    for (const word of segment.getWords()) {
      const fontFamily = this.captionFontFamilyResolver.wordFontFamily(
        word.displayText,
        elementStyles.fieldText(word.id, ElementFieldId.FONT_FAMILY),
        inherited,
      );
      if (fontFamily !== null) out.set(word.id, fontFamily);
    }
    return out;
  }
}
