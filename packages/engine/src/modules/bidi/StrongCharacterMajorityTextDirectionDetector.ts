import type { BidiCharacterClassifier } from '@modules/bidi/BidiCharacterClassifier';
import type { TextDirection } from '@modules/bidi/TextDirection';
import type { TextDirectionDetector } from '@modules/bidi/TextDirectionDetector';

/**
 * Decides by counting: whichever direction more of the text's own
 * directional characters carry wins, and a text with none reads left to
 * right.
 *
 * The standard's own fallback — take the direction of the first strong
 * character — is a poor fit for a long text, because a single foreign
 * name at the start would speak for everything after it. Counting looks
 * at the whole text instead.
 *
 * A tie, or a text where a minority script still dominates the meaning,
 * resolves left to right. That is the conservative side: a text wrongly
 * read as right-to-left rearranges every line of it, while the opposite
 * mistake leaves the text in the order it was written.
 */
export class StrongCharacterMajorityTextDirectionDetector implements TextDirectionDetector {

  constructor(private readonly characterClassifier: BidiCharacterClassifier) {}

  detect(text: string): TextDirection {
    let rightToLeft = 0;
    let leftToRight = 0;
    for (const character of text) {
      const direction = this.characterClassifier.strongDirectionOf(character);
      if (direction === 'rtl') rightToLeft++;
      else if (direction === 'ltr') leftToRight++;
    }
    return rightToLeft > leftToRight ? 'rtl' : 'ltr';
  }
}
