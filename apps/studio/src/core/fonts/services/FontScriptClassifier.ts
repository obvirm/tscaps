import type { FontScript } from '@core/fonts/domain/FontCatalog';

// `Script_Extensions` so the letters Persian and Urdu add to the Arabic
// script count with it.
const ARABIC = /\p{Script_Extensions=Arabic}/u;
const HEBREW = /\p{Script=Hebrew}/u;
const LATIN = /\p{Script=Latin}/u;

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
 * face for (including scripts it knows nothing about, like Cyrillic or
 * Devanagari) — the caller keeps the chosen family in that case, because
 * there is no better-informed face to offer.
 *
 * A tie resolves in declaration order below, Latin first: mis-leading a
 * stack toward Latin keeps today's behaviour, while mis-leading it away
 * from Latin changes the metrics of every caption on the sheet.
 */
export class FontScriptClassifier {

  /**
   * Writing system of `text`. Never `'urdu'`: Urdu is written in the Arabic
   * script, so no amount of looking at letters separates the two — only the
   * language does, and a short text does not carry it.
   */
  classify(text: string): FontScript | null {
    let latin = 0;
    let arabic = 0;
    let hebrew = 0;
    for (const character of text) {
      if (ARABIC.test(character)) arabic++;
      else if (HEBREW.test(character)) hebrew++;
      else if (LATIN.test(character)) latin++;
    }
    return this.pickWinner(latin, arabic, hebrew);
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

  private pickWinner(latin: number, arabic: number, hebrew: number): FontScript | null {
    const top = Math.max(latin, arabic, hebrew);
    if (top === 0) return null;
    if (latin === top) return 'latin';
    if (arabic === top) return 'arabic';
    return 'hebrew';
  }
}
