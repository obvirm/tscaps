const CLASS_IN_SELECTOR_PATTERN = /\.(-?[a-zA-Z_][a-zA-Z0-9_-]*)/g;
const KEYFRAMES_HEADER_PATTERN = /^\s*@(?:-webkit-|-moz-)?keyframes\b/;

/**
 * Returns every class name used in rule selectors across the given
 * source. `@keyframes` bodies are skipped entirely (their selectors
 * are offsets, not element selectors); every other at-rule body is
 * scanned recursively so selectors inside `@container` / `@media` /
 * `@supports` blocks are covered.
 *
 * Only selector headers are scanned — declaration bodies are not, so
 * a dot inside a value (`url(image.png)`) never registers. Pass the
 * source through {@link CssMinifier} first so commented-out rules
 * don't count. Selectors nested inside style-rule bodies (native CSS
 * nesting) are not scanned.
 */
export class CssSelectorClassScanner {

  scan(css: string): Set<string> {
    const found = new Set<string>();
    this.scanRange(css, 0, css.length, found);
    return found;
  }

  private scanRange(css: string, start: number, end: number, found: Set<string>): void {
    let i = start;
    while (i < end) {
      const brace = css.indexOf('{', i);
      if (brace === -1 || brace >= end) return;
      const header = css.slice(i, brace);
      const bodyStart = brace + 1;
      const bodyEnd = this.findMatchingClose(css, bodyStart, end);
      if (KEYFRAMES_HEADER_PATTERN.test(header.trimStart())) {
        // skip: keyframe step selectors are percentages, not elements
      } else if (header.trimStart().startsWith('@')) {
        this.scanRange(css, bodyStart, bodyEnd, found);
      } else {
        this.collectClasses(header, found);
      }
      i = bodyEnd + 1;
    }
  }

  private collectClasses(header: string, found: Set<string>): void {
    for (const match of header.matchAll(CLASS_IN_SELECTOR_PATTERN)) {
      found.add(match[1]!);
    }
  }

  /**
   * Index of the `}` closing the block opened just before `start`.
   * String literals are respected so braces inside them don't shift
   * the depth. Falls back to `end` when the block is unterminated.
   */
  private findMatchingClose(css: string, start: number, end: number): number {
    let depth = 1;
    let i = start;
    let stringDelim: '"' | "'" | null = null;
    while (i < end) {
      const ch = css[i]!;
      if (stringDelim) {
        if (ch === '\\' && i + 1 < end) { i += 2; continue; }
        if (ch === stringDelim) stringDelim = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") { stringDelim = ch; i++; continue; }
      if (ch === '{') { depth++; i++; continue; }
      if (ch === '}') {
        depth--;
        if (depth === 0) return i;
        i++;
        continue;
      }
      i++;
    }
    return end;
  }
}
