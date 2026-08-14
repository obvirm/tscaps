import type { Word } from '@modules/document/Word';

/**
 * Turns the text of one cue into the words it holds, timed.
 *
 * Implementations differ in how much the file told them: some formats
 * time nothing below the cue and leave the words to be guessed at,
 * others mark when each word is spoken and can be taken at their word.
 */
export interface CueWordReader {
  read(text: string, startSeconds: number, endSeconds: number): ReadonlyArray<Word>;
}
