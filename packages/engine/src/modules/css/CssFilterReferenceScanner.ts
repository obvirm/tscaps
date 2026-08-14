const FILTER_URL_PATTERN = /url\(\s*['"]?#([a-zA-Z0-9_-]+)['"]?\s*\)/g;

/**
 * Returns every SVG filter id a stylesheet points at through
 * `url(#id)`. Comparing this against the ids a document defines finds
 * both references that resolve to nothing and definitions nothing uses.
 *
 * Cheap regex scan rather than a CSS parse; pass the source through
 * {@link CssMinifier} first so commented-out rules don't count. Any
 * `url(#…)` counts, not only those in a `filter` declaration —
 * `mask`, `clip-path` and `fill` reference document fragments the same
 * way, and all of them need the fragment to exist.
 */
export class CssFilterReferenceScanner {

  scan(css: string): Set<string> {
    const found = new Set<string>();
    for (const match of css.matchAll(FILTER_URL_PATTERN)) {
      found.add(match[1]!);
    }
    return found;
  }
}
