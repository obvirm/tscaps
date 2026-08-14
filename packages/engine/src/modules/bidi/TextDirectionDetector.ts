import type { TextDirection } from '@modules/bidi/TextDirection';

/**
 * Infers the direction a text is meant to be read in.
 *
 * The answer is a starting point, not a verdict: text that mixes scripts
 * is genuinely ambiguous, so consumers are expected to let the reader
 * override whatever comes back.
 */
export interface TextDirectionDetector {
  detect(text: string): TextDirection;
}
