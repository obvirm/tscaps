import type { TextDirection } from '@tscaps/engine';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

/**
 * Emits the `--tscaps-text-direction` CSS variable carrying the sheet's
 * paragraph direction as `ltr` or `rtl`.
 *
 * Words reach the DOM already ordered the way they paint, inside a line
 * pinned left to right, so a template cannot recover the reading direction
 * from layout. It reads this variable instead, typically through
 * `@container style(--tscaps-text-direction: rtl)`, to mirror the parts of
 * its design that point at a side: a speech-bubble tail, an anchor column,
 * the direction an entrance animation slides from.
 */
export class TextDirectionCssVarBuilder {
  build(textDirection: TextDirection): Record<string, string> {
    return {
      [TemplateCssVariable.TEXT_DIRECTION]: textDirection,
    };
  }
}
