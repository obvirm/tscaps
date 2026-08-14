import { SvgFilterRecipe } from '@core/templates/services/filter-recipes/SvgFilterRecipe';

const RECIPE_CALL_START = /<tscaps:([a-zA-Z][\w-]*)\b/;
const NAMESPACE_DECLARATION = /\s*xmlns:tscaps="[^"]*"/g;

/**
 * Replaces `<tscaps:name …/>` calls in a template's `filters.svg` with
 * the primitives their recipe expands to, leaving flat, standard SVG
 * that the runtime parser can read and a person can edit.
 *
 * Calls are self-closing leaf elements, so expansion is a node swap
 * with attribute substitution — no cascade, no expression evaluation.
 * The `xmlns:tscaps` declaration that made the source valid XML is
 * dropped from the output, since nothing in it is namespaced any more.
 */
export class SvgRecipeExpander {
  constructor(private readonly recipes: ReadonlyMap<string, SvgFilterRecipe>) {}

  expand(source: string): string {
    let out = '';
    let rest = source;
    for (;;) {
      const call = RECIPE_CALL_START.exec(rest);
      if (!call) break;
      const start = call.index;
      const end = this.findTagEnd(rest, start, call[1]!);
      const before = rest.slice(0, start);
      const rendered = this.renderCall(call[1]!, rest.slice(start, end));
      out += before + this.reindent(rendered, this.indentationOf(before));
      rest = rest.slice(end);
    }
    return (out + rest).replace(NAMESPACE_DECLARATION, '');
  }

  private renderCall(name: string, tag: string): string {
    const recipe = this.recipes.get(name);
    if (!recipe) {
      throw new Error(
        `No filter recipe named "${name}". Available: ${[...this.recipes.keys()].sort().join(', ')}.`,
      );
    }
    const attributeSource = tag.slice(`<tscaps:${name}`.length, tag.lastIndexOf('/>'));
    return recipe.render(SvgFilterRecipe.parseAttributes(attributeSource));
  }

  /** Whitespace between the last line break and the call, which is where the expansion has to line up. */
  private indentationOf(precedingText: string): string {
    const lastBreak = precedingText.lastIndexOf('\n');
    const lineStart = precedingText.slice(lastBreak + 1);
    return /^\s*$/.test(lineStart) ? lineStart : '';
  }

  private reindent(rendered: string, indentation: string): string {
    return rendered.split('\n').map((line, index) => (index === 0 ? line : indentation + line)).join('\n');
  }

  /**
   * Locates the `/>` that closes a call, ignoring any that sits inside
   * an attribute value — `url(#id)` and `var(--x, 1/2)` are ordinary
   * things to write in a filter attribute.
   */
  private findTagEnd(source: string, start: number, name: string): number {
    let quote: string | null = null;
    for (let i = start; i < source.length; i++) {
      const char = source[i]!;
      if (quote !== null) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '>') {
        if (source[i - 1] !== '/') {
          throw new Error(`<tscaps:${name}> must be self-closing.`);
        }
        return i + 1;
      }
    }
    throw new Error(`<tscaps:${name}> is never closed.`);
  }
}
