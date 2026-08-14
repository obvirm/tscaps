import { TimeFragment } from '@modules/document/TimeFragment';
import { Word } from '@modules/document/Word';

/**
 * Invents a window for each word of a span the source only timed as a
 * whole, sharing the span out in proportion to how long each word is to
 * write. A rough stand-in for measured timings, and the best a file
 * that never recorded them can offer.
 *
 * A span of no length, or words that are all empty, leaves every word
 * covering the whole span rather than dividing by zero.
 */
export class WordTimingEstimator {

  spread(
    tokens: ReadonlyArray<string>,
    startSeconds: number,
    endSeconds: number,
  ): ReadonlyArray<Word> {
    const totalWeight = tokens.reduce((sum, token) => sum + token.length, 0);
    const duration = endSeconds - startSeconds;
    if (totalWeight === 0 || duration <= 0) {
      return tokens.map((token) => new Word({
        text: token,
        time: new TimeFragment(startSeconds, endSeconds),
      }));
    }
    const words: Word[] = [];
    let elapsedWeight = 0;
    for (const token of tokens) {
      const wordStart = startSeconds + (elapsedWeight / totalWeight) * duration;
      elapsedWeight += token.length;
      const wordEnd = startSeconds + (elapsedWeight / totalWeight) * duration;
      words.push(new Word({ text: token, time: new TimeFragment(wordStart, wordEnd) }));
    }
    return words;
  }
}
