/** Comment-free CSS made safe to embed, and what had to change to get there. */
export interface SealedCss {
  readonly css: string;
  /** `}` characters dropped because they closed a block the excerpt never opened. */
  readonly strayClosers: number;
  /** `}` characters appended because the excerpt left that many blocks open. */
  readonly appendedClosers: number;
}

/**
 * Makes a CSS excerpt safe to paste inside an enclosing block.
 *
 * An excerpt written by hand carries a `}` too many or too few often
 * enough to plan for, and inside a wrapper each one means something
 * worse than a broken rule: a surplus closer ends the wrapper early, so
 * everything after it lands at a nesting it was never written for, and a
 * missing one swallows whatever follows. Sealing drops the closers with
 * nothing to close and appends the ones the excerpt is missing, which
 * confines the damage to the excerpt itself.
 *
 * Input must already be comment-free — run it through {@link CssMinifier}
 * first, or a brace inside a comment counts. String literals are skipped
 * here, so a brace inside one does not.
 *
 * Both counts are reported rather than swallowed: an excerpt that had to
 * be repaired is worth saying out loud to whoever wrote it.
 */
export class CssBlockSealer {
  seal(css: string): SealedCss {
    let kept = '';
    let depth = 0;
    let strayClosers = 0;
    let stringDelimiter: string | null = null;
    let index = 0;

    while (index < css.length) {
      const character = css[index]!;
      if (stringDelimiter !== null) {
        kept += character;
        if (character === '\\' && index + 1 < css.length) {
          kept += css[index + 1];
          index += 2;
          continue;
        }
        if (character === stringDelimiter) stringDelimiter = null;
        index++;
        continue;
      }
      if (character === '"' || character === "'") {
        stringDelimiter = character;
      } else if (character === '{') {
        depth++;
      } else if (character === '}') {
        if (depth === 0) {
          strayClosers++;
          index++;
          continue;
        }
        depth--;
      }
      kept += character;
      index++;
    }

    return {
      css: depth > 0 ? kept + '}'.repeat(depth) : kept,
      strayClosers,
      appendedClosers: depth,
    };
  }
}
