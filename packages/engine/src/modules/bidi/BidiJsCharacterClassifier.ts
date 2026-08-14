import bidiFactory, { type Bidi } from 'bidi-js';
import type { BidiCharacterClassifier } from '@modules/bidi/BidiCharacterClassifier';
import type { TextDirection } from '@modules/bidi/TextDirection';

// The Unicode bidi classes that carry a direction of their own: `L` for
// left-to-right letters, `R` and `AL` for right-to-left ones (`AL` being the
// Arabic script specifically). Every other class is context-dependent.
const STRONG_LEFT_TO_RIGHT = 'L';
const STRONG_RIGHT_TO_LEFT = new Set(['R', 'AL']);

/** Character classification read from the Unicode tables of a UAX #9 implementation. */
export class BidiJsCharacterClassifier implements BidiCharacterClassifier {
  private readonly bidi: Bidi = bidiFactory();

  strongDirectionOf(character: string): TextDirection | null {
    const type = this.bidi.getBidiCharTypeName(character);
    if (type === STRONG_LEFT_TO_RIGHT) return 'ltr';
    if (STRONG_RIGHT_TO_LEFT.has(type)) return 'rtl';
    return null;
  }
}
