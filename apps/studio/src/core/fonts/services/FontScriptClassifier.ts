import type { FontScript } from '@core/fonts/domain/FontCatalog';

// `Script_Extensions` so the letters Persian and Urdu add to the Arabic
// script count with it.
const ARABIC = /\p{Script_Extensions=Arabic}/u;
const HEBREW = /\p{Script=Hebrew}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const GREEK = /\p{Script=Greek}/u;
const DEVANAGARI = /\p{Script=Devanagari}/u;
const LATIN = /\p{Script=Latin}/u;

// Tried in this order, and a character counts for the first script that
// claims it. Latin sits last because Arabic's script extensions reach into
// characters the earlier entries should win.
const PATTERNS: ReadonlyArray<readonly [FontScript, RegExp]> = [
  ['arabic', ARABIC],
  ['hebrew', HEBREW],
  ['devanagari', DEVANAGARI],
  ['cyrillic', CYRILLIC],
  ['greek', GREEK],
  ['latin', LATIN],
];

// A tie resolves in this order, Latin first: mis-leading a stack toward Latin
// keeps today's behaviour, while mis-leading it away from Latin changes the
// metrics of every caption on the sheet.
const TIE_ORDER: readonly FontScript[] = ['latin', 'arabic', 'hebrew', 'cyrillic', 'greek', 'devanagari'];

// Letters Urdu adds to the Arabic script and Persian does not use, so their
// presence separates the two without misreading Persian as Urdu. Deliberately
// conservative: Urdu text that happens to avoid all of them classifies as
// plain Arabic and gets the Arabic face instead of the Nastaliq one.
const URDU_MARKERS = /[ٹڈڑںہے]/u;

/**
 * Decides which of the catalog's faces a text should be drawn with, by
 * simple majority of its letters. Punctuation, digits and whitespace carry
 * no script and do not vote.
 *
 * Returns `null` when no letter belongs to a script the catalog ships a
 * face for — the caller keeps the chosen family in that case, because
 * there is no better-informed face to offer.
 */
export class FontScriptClassifier {

  /**
   * Writing system of `text`. Never `'urdu'`: Urdu is written in the Arabic
   * script, so no amount of looking at letters separates the two — only the
   * language does, and a short text does not carry it.
   */
  classify(text: string): FontScript | null {
    return this.pickWinner(this.count(text));
  }

  /**
   * Every script the catalog ships a face for that `text` holds at least
   * one letter of. Presence, where `classify` answers majority: this one
   * says which faces could be called on to draw something, not which one
   * should lead a stack.
   *
   * Never reports `'urdu'`, for the same reason `classify` does not — the
   * letters do not separate it from the rest of the Arabic script, so
   * Urdu text reports `'arabic'`.
   */
  scriptsIn(text: string): Set<FontScript> {
    return new Set(this.count(text).keys());
  }

  /**
   * Same, refined with the language the text is written in, which tells
   * Urdu apart from the rest of the Arabic script and earns it the Nastaliq
   * face.
   *
   * Only sound over a whole body of captions: the letters that mark Urdu
   * appear in some of its words and not others, so asking this of a single
   * word would answer Urdu for some words of a sentence and Arabic for the
   * rest, and paint one line in two unrelated styles.
   */
  classifyWithLanguage(text: string): FontScript | null {
    const script = this.classify(text);
    if (script !== 'arabic') return script;
    return URDU_MARKERS.test(text) ? 'urdu' : script;
  }

  /** How many of the text's letters each script claims. Scripts with none are absent. */
  private count(text: string): Map<FontScript, number> {
    const counts = new Map<FontScript, number>();
    for (const character of text) {
      const script = PATTERNS.find(([, pattern]) => pattern.test(character))?.[0];
      if (script === undefined) continue;
      counts.set(script, (counts.get(script) ?? 0) + 1);
    }
    return counts;
  }

  private pickWinner(counts: ReadonlyMap<FontScript, number>): FontScript | null {
    const top = Math.max(0, ...counts.values());
    if (top === 0) return null;
    return TIE_ORDER.find((script) => counts.get(script) === top) ?? null;
  }
}
