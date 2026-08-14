/**
 * Markup a caption file may wrap its text in: WebVTT's angle-bracket
 * tags and the brace-delimited overrides SubRip files sometimes carry
 * from SubStation. None of it survives into a word.
 */
const MARKUP = /<[^>]+>|\{[^}]+\}/g;

/**
 * Reduces the text of one cue to the words it says.
 *
 * Markup is dropped, runs of whitespace collapse, and a cue that turns
 * out to hold nothing but markup yields no words at all.
 */
export class CueTextTokenizer {

  tokenize(text: string): ReadonlyArray<string> {
    return text
      .replace(MARKUP, '')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }
}
