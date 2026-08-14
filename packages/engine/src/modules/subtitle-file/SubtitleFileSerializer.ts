import { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleCueBuilder } from '@modules/subtitle-file/SubtitleCueBuilder';
import { SubtitleRow } from '@modules/subtitle-file/SubtitleRow';
import type { SubtitleFileJob } from '@modules/subtitle-file/SubtitleFileJob';
import type { SubtitleGranularity } from '@modules/subtitle-file/SubtitleGranularity';

/**
 * Writes a document out as one subtitle file format.
 *
 * The declared media type and extension travel with the serializer, so
 * everything a caller needs in order to hand the result to a user comes
 * from the object that produced it.
 *
 * Every format is written from the same corrected view of the document,
 * which is why the shared preparation lives here and subclasses are
 * left with nothing but their own syntax. What differs is how far a
 * format can honour `granularity`: some carry word timing inside a
 * normal entry, some can only reach it by emitting one entry per word,
 * and some carry no timing at all.
 *
 * A document with nothing to show yields an empty body rather than an
 * error.
 */
export abstract class SubtitleFileSerializer {
  private readonly cueBuilder = new SubtitleCueBuilder();

  /** Media type of the produced text. */
  abstract readonly mediaType: string;

  /** Filename extension, without the leading dot. */
  abstract readonly fileExtension: string;

  serialize(job: SubtitleFileJob): string {
    const cues = this.cueBuilder.build(job.document, job.skipRanges ?? []);
    return this.write(cues, job.granularity);
  }

  protected abstract write(
    cues: ReadonlyArray<SubtitleCue>,
    granularity: SubtitleGranularity,
  ): string;

  /**
   * The same content cut down to one entry per word, for a format whose
   * only way to express word timing is to multiply its entries. Words
   * covering an empty window drop out, since no player would show them.
   */
  protected perWordCues(cues: ReadonlyArray<SubtitleCue>): ReadonlyArray<SubtitleCue> {
    const perWord: SubtitleCue[] = [];
    for (const cue of cues) {
      for (const token of cue.tokens()) {
        if (token.time.duration <= 0) continue;
        perWord.push(new SubtitleCue(token.time, [new SubtitleRow([token])]));
      }
    }
    return perWord;
  }
}
