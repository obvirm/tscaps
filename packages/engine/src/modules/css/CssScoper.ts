import { CssKeyframeNamespacer } from '@modules/css/CssKeyframeNamespacer';
const AT_RULE_NAME_RE = /^@([a-zA-Z][a-zA-Z0-9-]*)/;

/** At-rules whose body holds regular style rules — selectors inside must be scoped. */
const SCOPEABLE_AT_RULES: ReadonlySet<string> = new Set([
  'container',
  'media',
  'supports',
  'layer',
  'scope',
]);

/**
 * Boundary that closes one top-level CSS construct. `brace` marks the
 * `{` that opens a rule body; `semi` marks the `;` that terminates a
 * statement-form at-rule (`@charset`, `@import`, ...); `end` means the
 * scanned range finished without either.
 */
interface RuleTerminator {
  readonly index: number;
  readonly kind: 'brace' | 'semi' | 'end';
}

/**
 * Scopes a CSS string so it can coexist with sibling stylesheets in
 * the same document. Top-level selectors get prefixed with
 * `scopeSelector`; every `@keyframes` declaration is renamed to a
 * scope-unique form and the matching `animation-name` / `animation`
 * shorthand references in the same stylesheet are rewritten in step.
 *
 * Selectors inside conditional at-rule bodies (`@container`, `@media`,
 * `@supports`, `@layer`, `@scope`) are scoped recursively — without
 * this, a rule like `@container … { .foo { … } }` would emit unscoped
 * `.foo` and lose to the top-level scoped version on specificity.
 *
 * `scopeSelector` is expected to be a simple class selector
 * (e.g. `.my-scope`); its identifier portion seeds the keyframe rename.
 */
export class CssScoper {
  private readonly keyframeNamespacer = new CssKeyframeNamespacer();

  scope(css: string, scopeSelector: string): string {
    const scopeKey = scopeSelector.replace(/^\.+/, '');
    return this.scopeSelectorsInRange(this.keyframeNamespacer.namespace(css, scopeKey), 0, undefined, scopeSelector);
  }

  private scopeSelectorsInRange(
    css: string,
    start: number,
    end: number | undefined,
    scopeSelector: string,
  ): string {
    const stopAt = end ?? css.length;
    let result = '';
    let i = start;
    while (i < stopAt) {
      const ch = css[i]!;
      if (this.isWhitespace(ch)) { result += ch; i++; continue; }
      if (this.isCommentStart(css, i)) {
        const commentEnd = this.findCommentEnd(css, i, stopAt);
        result += css.slice(i, commentEnd);
        i = commentEnd;
        continue;
      }
      const { index: ruleEnd, kind } = this.findRuleTerminator(css, i, stopAt);
      if (kind === 'end') { result += css.slice(i, stopAt); return result; }
      if (kind === 'semi') {
        // Statement-form at-rule (`@charset`, `@import`, `@namespace`,
        // `@layer name;`): no block to scope, emit as-is and advance.
        result += css.slice(i, ruleEnd + 1);
        i = ruleEnd + 1;
        continue;
      }

      const header = css.slice(i, ruleEnd);
      const bodyStart = ruleEnd + 1;
      const bodyEnd = this.findMatchingClose(css, bodyStart, stopAt);

      if (this.isAtRuleHeader(header)) {
        result += `${header}{`;
        result += this.scopeAtRuleBody(css, bodyStart, bodyEnd, header, scopeSelector);
        result += '}';
      } else {
        result += `${this.scopeCompoundSelector(header, scopeSelector)} {`;
        result += css.slice(bodyStart, bodyEnd);
        result += '}';
      }
      i = bodyEnd + 1;
    }
    return result;
  }

  private scopeAtRuleBody(
    css: string,
    bodyStart: number,
    bodyEnd: number,
    header: string,
    scopeSelector: string,
  ): string {
    const name = this.extractAtRuleName(header);
    if (SCOPEABLE_AT_RULES.has(name)) {
      return this.scopeSelectorsInRange(css, bodyStart, bodyEnd, scopeSelector);
    }
    return css.slice(bodyStart, bodyEnd);
  }

  private scopeCompoundSelector(selector: string, scopeSelector: string): string {
    return selector
      .trim()
      .split(',')
      .map((s) => `${scopeSelector} ${s.trim()}`)
      .join(', ');
  }

  private isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
  }

  private isCommentStart(css: string, i: number): boolean {
    return css[i] === '/' && css[i + 1] === '*';
  }

  private findCommentEnd(css: string, commentStart: number, stopAt: number): number {
    const closeIndex = css.indexOf('*/', commentStart + 2);
    return closeIndex === -1 || closeIndex >= stopAt ? stopAt : closeIndex + 2;
  }

  /**
   * Locates the boundary that ends the current top-level construct:
   * `{` opens a rule block, `;` terminates a statement-form at-rule
   * (`@charset`, `@import`, `@namespace`, `@layer name;`), and `end`
   * means the range was consumed without either.
   *
   * Skips over string literals and CSS comments so a `;` inside a
   * `url("…")` or a commented-out block doesn't fool the caller.
   */
  private findRuleTerminator(css: string, start: number, stopAt: number): RuleTerminator {
    let i = start;
    let stringDelim: '"' | "'" | null = null;
    while (i < stopAt) {
      const ch = css[i]!;
      if (stringDelim) {
        if (ch === '\\' && i + 1 < stopAt) { i += 2; continue; }
        if (ch === stringDelim) stringDelim = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === '\'') { stringDelim = ch; i++; continue; }
      if (this.isCommentStart(css, i)) { i = this.findCommentEnd(css, i, stopAt); continue; }
      if (ch === '{') return { index: i, kind: 'brace' };
      if (ch === ';') return { index: i, kind: 'semi' };
      i++;
    }
    return { index: stopAt, kind: 'end' };
  }

  private isAtRuleHeader(header: string): boolean {
    return header.trimStart().startsWith('@');
  }

  private extractAtRuleName(header: string): string {
    const match = header.trimStart().match(AT_RULE_NAME_RE);
    return match ? match[1]!.toLowerCase() : '';
  }

  /**
   * Returns the index of the `}` that closes the block opened just
   * before `start`. Respects string literals and CSS comments so that
   * `{`/`}` characters appearing inside them don't shift the depth.
   * Falls back to `stopAt` if the block is unterminated within range.
   */
  private findMatchingClose(css: string, start: number, stopAt: number): number {
    let depth = 1;
    let i = start;
    let stringDelim: '"' | "'" | null = null;
    while (i < stopAt) {
      const ch = css[i]!;
      if (stringDelim) {
        if (ch === '\\' && i + 1 < stopAt) { i += 2; continue; }
        if (ch === stringDelim) stringDelim = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === '\'') { stringDelim = ch; i++; continue; }
      if (this.isCommentStart(css, i)) { i = this.findCommentEnd(css, i, stopAt); continue; }
      if (ch === '{') { depth++; i++; continue; }
      if (ch === '}') {
        depth--;
        if (depth === 0) return i;
        i++;
        continue;
      }
      i++;
    }
    return stopAt;
  }
}
