const VAR_REFERENCE_PATTERN = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
const STYLE_QUERY_PATTERN = /style\(\s*(--[a-zA-Z0-9_-]+)/g;

/**
 * Returns every CSS custom property name the given source reads, whether
 * it substitutes the value with `var(--name)` or tests it in a style
 * query such as `@container style(--name: rtl)`.
 *
 * Cheap regex scan rather than a CSS parse. False positives are
 * limited to literal `var(--…)` / `style(--…)` substrings inside string
 * values; pass the source through {@link CssMinifier} first to drop
 * comments that would otherwise contribute to the result. Over-inclusion
 * is harmless — it only keeps a property that would have been dropped.
 */
export class CssVarReferenceScanner {

  scan(css: string): Set<string> {
    const found = new Set<string>();
    this.collectMatches(css, VAR_REFERENCE_PATTERN, found);
    this.collectMatches(css, STYLE_QUERY_PATTERN, found);
    return found;
  }

  private collectMatches(css: string, pattern: RegExp, found: Set<string>): void {
    for (const match of css.matchAll(pattern)) {
      found.add(match[1]!);
    }
  }
}
