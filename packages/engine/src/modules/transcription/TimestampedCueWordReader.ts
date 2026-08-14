import type { Word } from '@modules/document/Word';
import type { CueTextTokenizer } from '@modules/transcription/CueTextTokenizer';
import type { CueTimecodeReader } from '@modules/transcription/CueTimecodeReader';
import type { CueWordReader } from '@modules/transcription/CueWordReader';
import type { WordTimingEstimator } from '@modules/transcription/WordTimingEstimator';

/** A cue timestamp: a position on its own inside the cue's text. */
const CUE_TIMESTAMP = /<(?:\d{1,3}:)?\d{2}:\d{2}[.,]\d{1,3}>/g;

/** One stretch of a cue and the window it was marked as occupying. */
interface TimedStretch {
  readonly text: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

/**
 * Reads a cue from a format that can mark, inside the cue's own text,
 * when a word is spoken — WebVTT does this so a caption can be revealed
 * word by word without being broken into an entry per word.
 *
 * Each mark cuts the cue into a stretch that runs until the next mark,
 * and the words of a stretch share it out between them. A mark before
 * every word therefore yields the timing the file recorded; a mark
 * every few words yields those, with the words between them estimated.
 * A cue carrying no marks at all is one stretch, which is the same
 * answer a format without marks would give.
 */
export class TimestampedCueWordReader implements CueWordReader {
  constructor(
    private readonly tokenizer: CueTextTokenizer,
    private readonly timecodeReader: CueTimecodeReader,
    private readonly estimator: WordTimingEstimator,
  ) {}

  read(text: string, startSeconds: number, endSeconds: number): ReadonlyArray<Word> {
    return this.cutIntoStretches(text, startSeconds, endSeconds)
      .flatMap((stretch) => [
        ...this.estimator.spread(
          this.tokenizer.tokenize(stretch.text),
          stretch.startSeconds,
          stretch.endSeconds,
        ),
      ]);
  }

  private cutIntoStretches(
    text: string,
    startSeconds: number,
    endSeconds: number,
  ): ReadonlyArray<TimedStretch> {
    const stretches: TimedStretch[] = [];
    let textFrom = 0;
    let stretchStart = startSeconds;
    for (const mark of text.matchAll(CUE_TIMESTAMP)) {
      const markAt = this.positionOf(mark[0]);
      const markFrom = mark.index ?? 0;
      stretches.push({
        text: text.slice(textFrom, markFrom),
        startSeconds: stretchStart,
        endSeconds: markAt,
      });
      textFrom = markFrom + mark[0].length;
      stretchStart = markAt;
    }
    stretches.push({ text: text.slice(textFrom), startSeconds: stretchStart, endSeconds });
    return stretches;
  }

  private positionOf(mark: string): number {
    return this.timecodeReader.readPosition(mark.slice(1, -1));
  }
}
