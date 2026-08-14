import type { FontScript } from '@core/fonts/domain/FontCatalog';
import type { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';

/** What a word falls back to when it declares no `font-family` of its own. */
export interface InheritedFontContext {
  /** Family of the nearest ancestor that declares one: the segment's override family when set, else the sheet's. */
  readonly family: string;
  /** `font-family` value that ancestor emits. */
  readonly stack: string;
  /** Writing system the surrounding captions are in, which settles what a single word cannot say about itself. */
  readonly script: FontScript | null;
}

/**
 * Decides the `font-family` value each caption element below the sheet
 * wrapper declares, so every element's stack is led by the face that draws
 * its own text and the vertical metrics come from the font that paints.
 *
 * A word in the same script as its surroundings declares nothing: the
 * ancestor's stack already leads with the right face, and repeating the
 * value on every word would bloat each rendered frame. A word in another
 * script declares its own stack. A word with no letters of a known script
 * (bare punctuation, digits) always inherits, whatever the surrounding
 * script: its characters render in any face, and sitting on the ancestor's
 * metrics keeps it aligned with the words around it. A word the user gave
 * its own family always declares it, resolved for the word's text.
 */
export class CaptionFontFamilyResolver {

  constructor(
    private readonly fontStackResolver: FontStackResolver,
    private readonly scriptClassifier: FontScriptClassifier,
  ) {}

  /** Stack a segment's font override emits, led by the face that draws the sheet's script. */
  segmentOverrideStack(overrideFamily: string, sheetScript: FontScript | null): string {
    return this.fontStackResolver.resolveForScript(overrideFamily, sheetScript);
  }

  /** The fallback context for the words of one segment. */
  inheritedContext(
    sheetFamily: string,
    segmentOverrideFamily: string | null,
    sheetScript: FontScript | null,
  ): InheritedFontContext {
    const family = segmentOverrideFamily ?? sheetFamily;
    return {
      family,
      stack: this.fontStackResolver.resolveForScript(family, sheetScript),
      script: sheetScript,
    };
  }

  /** The `font-family` one word's element declares, or `null` to inherit. */
  wordFontFamily(
    wordText: string,
    overrideFamily: string | null,
    inherited: InheritedFontContext,
  ): string | null {
    const wordScript = this.wordScript(wordText, inherited.script);
    if (overrideFamily !== null) {
      return this.fontStackResolver.resolveForScript(overrideFamily, wordScript);
    }
    if (wordScript === null) return null;
    const resolved = this.fontStackResolver.resolveForScript(inherited.family, wordScript);
    return resolved === inherited.stack ? null : resolved;
  }

  /**
   * A word states its writing system, and the surroundings state the
   * language. Urdu is the Arabic script written in another tradition, and
   * the letters that mark it appear in some Urdu words and not others — so
   * a word that reads as Arabic inside Urdu captions is Urdu too. Reading
   * it word by word would set part of a sentence in Nastaliq and the rest
   * in a Naskh face.
   */
  private wordScript(wordText: string, surroundingScript: FontScript | null): FontScript | null {
    const script = this.scriptClassifier.classify(wordText);
    return script === 'arabic' && surroundingScript === 'urdu' ? 'urdu' : script;
  }
}
