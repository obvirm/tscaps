const WOFF2_SOURCE = /format\(\s*['"]?woff2['"]?\s*\)|\.woff2\b/i;

// Plain woff, and never woff2: `\b` after the name fails against the `2`,
// and the closing paren fails against `format('woff2')`.
const LEGACY_WOFF_SOURCE = /format\(\s*['"]?woff['"]?\s*\)|\.woff\b/i;

// The `src` descriptor, anchored so it cannot match inside another value.
const SRC_DESCRIPTOR = /(?:^|[;{])\s*src\s*:/i;

/**
 * Drops the woff a `@font-face` rule offers beside its woff2.
 *
 * Font packages ship a family in both, for browsers predating the newer
 * format, and every source a rule lists gets fetched and embedded whole.
 * The older one is embedded for nobody: the browser rasterizing the
 * frames is the one running the app, and it has read woff2 for years.
 * Dropping it takes its bytes out of every frame the export draws.
 *
 * Nothing else is touched. A rule offering no woff2 keeps whatever it
 * has — an uploaded font arrives in the format its file was, and that
 * file is the one to embed — and a `local()` source stays, since a face
 * already on the machine is the cheapest of all.
 */
export class FontFaceSourceTrimmer {

  /** `cssText` with the superseded source dropped, or `cssText` itself when there is none. */
  trim(cssText: string): string {
    const descriptor = SRC_DESCRIPTOR.exec(cssText);
    if (!descriptor) return cssText;
    const valueStart = descriptor.index + descriptor[0].length;
    const valueEnd = this.findValueEnd(cssText, valueStart);
    const kept = this.withoutSupersededSources(cssText.slice(valueStart, valueEnd));
    if (kept === null) return cssText;
    return cssText.slice(0, valueStart) + kept + cssText.slice(valueEnd);
  }

  /**
   * The value without the sources a woff2 in the same rule supersedes,
   * or `null` when there is nothing to drop.
   */
  private withoutSupersededSources(value: string): string | null {
    const sources = this.splitTopLevel(value);
    if (!sources.some((source) => WOFF2_SOURCE.test(source))) return null;
    const kept = sources.filter((source) => !LEGACY_WOFF_SOURCE.test(source));
    if (kept.length === sources.length) return null;
    return ` ${kept.map((source) => source.trim()).join(', ')}`;
  }

  /** Index of the `;` or `}` closing the declaration, ignoring either inside parentheses. */
  private findValueEnd(cssText: string, from: number): number {
    let depth = 0;
    for (let i = from; i < cssText.length; i++) {
      const character = cssText[i]!;
      if (character === '(') depth++;
      else if (character === ')') depth--;
      else if (depth === 0 && (character === ';' || character === '}')) return i;
    }
    return cssText.length;
  }

  /** Splits on the commas separating sources, leaving those inside `url(...)` alone. */
  private splitTopLevel(value: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let current = '';
    for (const character of value) {
      if (character === '(') depth++;
      else if (character === ')') depth--;
      if (character === ',' && depth === 0) {
        out.push(current);
        current = '';
        continue;
      }
      current += character;
    }
    out.push(current);
    return out;
  }
}
