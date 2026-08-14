import type { TextDirection } from '@modules/bidi/TextDirection';

/**
 * Reads the direction Unicode assigns to a single character.
 *
 * Most characters carry none of their own: digits, punctuation, spaces
 * and symbols take their direction from whatever surrounds them, and
 * only letters of a directional script speak for themselves.
 */
export interface BidiCharacterClassifier {
  /** The character's own direction, or `null` when it takes one from its context. */
  strongDirectionOf(character: string): TextDirection | null;
}
