import type { FontFaceCssReader } from '@core/fonts/domain/FontFaceCssReader';
import type { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';
import type { UnicodeRangeParser } from '@core/fonts/services/UnicodeRangeParser';

/**
 * Builds the concatenated `@font-face` CSS for the requested families,
 * trimmed twice over: to the subsets whose `unicode-range` actually
 * covers the characters the document uses, and within each surviving
 * rule to the sources worth embedding. Font payloads subsetted by
 * `unicode-range` (Fontsource, Google Fonts) come down to the minimum
 * needed.
 */
export class FontFaceCssBuilder {

  constructor(
    private readonly reader: FontFaceCssReader,
    private readonly parser: UnicodeRangeParser,
    private readonly sourceTrimmer: FontFaceSourceTrimmer,
  ) {}

  build(families: ReadonlySet<string>, usedCodepoints: ReadonlySet<number>): string {
    const declarations = this.reader.read(families);
    const filtered = declarations.filter((d) =>
      this.parser.parse(d.unicodeRange).intersectsAny(usedCodepoints),
    );
    return filtered.map((d) => this.sourceTrimmer.trim(d.cssText)).join('\n');
  }
}
