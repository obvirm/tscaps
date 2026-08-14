import type { Word } from '@modules/document/Word';
import type { CueTextTokenizer } from '@modules/transcription/CueTextTokenizer';
import type { CueWordReader } from '@modules/transcription/CueWordReader';
import type { WordTimingEstimator } from '@modules/transcription/WordTimingEstimator';

/**
 * Reads a cue from a format that times nothing below the cue itself.
 * The words are known, when each is spoken is not, so the cue's own
 * window is shared out among them.
 */
export class EstimatedCueWordReader implements CueWordReader {
  constructor(
    private readonly tokenizer: CueTextTokenizer,
    private readonly estimator: WordTimingEstimator,
  ) {}

  read(text: string, startSeconds: number, endSeconds: number): ReadonlyArray<Word> {
    return this.estimator.spread(this.tokenizer.tokenize(text), startSeconds, endSeconds);
  }
}
