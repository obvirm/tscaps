import type { CatalogFont, FontScript, FontScriptFallbacks } from '@core/fonts/domain/FontCatalog';
import { DEFAULT_SCRIPT_FALLBACKS, FONT_CATALOG } from '@core/fonts/domain/FontCatalog';

/**
 * Turns a chosen font family into the CSS `font-family` value that renders
 * it: a stack holding the family and a stand-in for each script it has no
 * glyphs for.
 *
 * The first family of the stack is load-bearing beyond glyph choice: the
 * browser takes every line's baseline placement and minimum height (the
 * strut) from it, whether or not it draws a single character. A stack led
 * by a family that cannot draw the text therefore renders the right glyphs
 * with the wrong vertical metrics. `resolveForScript` exists for that: it
 * puts the face that draws the given script first, so metrics and glyphs
 * come from the same font. The rest of the stack stays as a safety net for
 * stray characters, never as the mechanism.
 *
 * Every name is quoted: family names holding a token that is not a valid CSS
 * identifier (`Press Start 2P`, whose `2P` opens with a digit) invalidate the
 * whole declaration unquoted, and the browser then silently falls back.
 */
export class FontStackResolver {
  private readonly byFamily: ReadonlyMap<string, CatalogFont>;

  constructor(catalog: ReadonlyArray<CatalogFont> = FONT_CATALOG) {
    this.byFamily = new Map(catalog.map((font) => [font.family, font]));
  }

  /** Stack led by the chosen family itself. For contexts with no script to resolve against. */
  resolve(family: string): string {
    return this.quoteAll([family, ...this.standInsFor(family)]);
  }

  /**
   * Stack led by the face that draws `script`, so the metrics the browser
   * takes from the stack's first family belong to the font that paints
   * the glyphs. Falls back to the family-led stack when `script` is
   * `null`, or when the family is not a catalog entry — an uploaded
   * font's coverage is unknown, and the chosen family keeps the lead
   * over a guess.
   */
  resolveForScript(family: string, script: FontScript | null): string {
    const leader = this.leaderFor(family, script);
    if (leader === null || leader === family) return this.resolve(family);
    return this.quoteAll([leader, family, ...this.standInsFor(family).filter((name) => name !== leader)]);
  }

  /**
   * The family whose designed script matches, or `null` when the chosen
   * family should keep the lead. Latin never displaces the chosen family:
   * every face in the catalog ships Latin glyphs, and the chosen family
   * is the one the reader picked to draw them.
   */
  private leaderFor(family: string, script: FontScript | null): string | null {
    if (script === null || script === 'latin') return null;
    const font = this.byFamily.get(family);
    if (font === undefined) return null;
    if (font.script === script) return null;
    return font.fallbacks[script] ?? DEFAULT_SCRIPT_FALLBACKS[script] ?? null;
  }

  private standInsFor(family: string): string[] {
    const fallbacks = this.byFamily.get(family)?.fallbacks ?? DEFAULT_SCRIPT_FALLBACKS;
    return this.fallbackFamilies(family, fallbacks);
  }

  private fallbackFamilies(family: string, fallbacks: FontScriptFallbacks): string[] {
    const candidates = [fallbacks.arabic, fallbacks.hebrew, fallbacks.urdu];
    const out: string[] = [];
    for (const candidate of candidates) {
      if (!candidate || candidate === family || out.includes(candidate)) continue;
      out.push(candidate);
    }
    return out;
  }

  private quoteAll(families: ReadonlyArray<string>): string {
    return families.map((name) => `'${name}'`).join(', ');
  }
}
