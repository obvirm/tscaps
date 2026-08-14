import { CssMinifier } from '@modules/css/CssMinifier';

/** One declaration at a fragment's top level. */
export interface CssFragmentDeclaration {
  readonly kind: 'declaration';
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly property: string;
  readonly value: string;
}

/** One block at a fragment's top level, with everything it holds. */
export interface CssFragmentBlock {
  readonly kind: 'block';
  readonly start: number;
  readonly end: number;
  readonly text: string;
  /** What precedes the braces: a selector, or an at-rule with its parameters. */
  readonly prelude: string;
}

export type CssFragmentPart = CssFragmentDeclaration | CssFragmentBlock;

/**
 * Splits a selectorless CSS fragment into the parts its top level is
 * made of: the declarations that apply to the element itself, and the
 * blocks that do not.
 *
 * Depth is the point. A declaration inside a nested rule or a keyframe
 * stop belongs to that block, not to the element, so anything deciding
 * what the fragment says about the element — or rewriting part of it —
 * has to be able to tell the two apart.
 *
 * Parts carry their offsets into the source, so a caller can remove
 * one by slicing and leave the surrounding text exactly as written.
 * Those offsets span the source as it was, comments included, while
 * the text a part reports has them taken out — a comment says nothing
 * about the element, but deleting a declaration has to delete the
 * comment sitting inside it too.
 *
 * String literals are left alone, and an unterminated block runs to
 * the end of the input.
 */
export class CssFragmentParser {
  constructor(private readonly minifier: CssMinifier) {}

  parse(css: string): CssFragmentPart[] {
    const parts: CssFragmentPart[] = [];
    let start = 0;
    let cursor = 0;
    while (cursor < css.length) {
      const skipped = this.skipInert(css, cursor);
      if (skipped !== cursor) {
        cursor = skipped;
        continue;
      }
      const char = css[cursor];
      if (char === '{') {
        const close = this.blockEnd(css, cursor);
        parts.push(this.block(css, start, close));
        cursor = close;
        start = cursor;
        continue;
      }
      if (char === ';') {
        const declaration = this.declaration(css, start, cursor + 1);
        if (declaration) parts.push(declaration);
        cursor++;
        start = cursor;
        continue;
      }
      cursor++;
    }
    const last = this.declaration(css, start, css.length);
    if (last) parts.push(last);
    return parts;
  }

  private block(css: string, start: number, end: number): CssFragmentBlock {
    const text = this.minifier.minify(css.slice(start, end));
    return {
      kind: 'block',
      start,
      end,
      text: text.trim(),
      prelude: text.slice(0, text.indexOf('{')).trim(),
    };
  }

  /** Null when the span holds nothing but whitespace, or no `:` to split a property from a value. */
  private declaration(css: string, start: number, end: number): CssFragmentDeclaration | null {
    const trimmed = this.minifier.minify(css.slice(start, end)).trim();
    if (trimmed.length === 0) return null;
    const colon = trimmed.indexOf(':');
    if (colon === -1) return null;
    return {
      kind: 'declaration',
      start,
      end,
      text: trimmed,
      property: trimmed.slice(0, colon).trim(),
      value: trimmed.slice(colon + 1).replace(/;$/, '').trim(),
    };
  }

  /** Index just past the `}` closing the block whose `{` sits at `open`. */
  private blockEnd(css: string, open: number): number {
    let depth = 0;
    let cursor = open;
    while (cursor < css.length) {
      const skipped = this.skipInert(css, cursor);
      if (skipped !== cursor) {
        cursor = skipped;
        continue;
      }
      const char = css[cursor];
      if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return cursor + 1;
      cursor++;
    }
    return css.length;
  }

  /** Index past a comment or string literal starting here, or `cursor` when neither does. */
  private skipInert(css: string, cursor: number): number {
    if (css[cursor] === '/' && css[cursor + 1] === '*') {
      const end = css.indexOf('*/', cursor + 2);
      return end === -1 ? css.length : end + 2;
    }
    const quote = css[cursor];
    if (quote !== '"' && quote !== "'") return cursor;
    let i = cursor + 1;
    while (i < css.length) {
      if (css[i] === '\\') {
        i += 2;
        continue;
      }
      if (css[i] === quote) return i + 1;
      i++;
    }
    return css.length;
  }
}
