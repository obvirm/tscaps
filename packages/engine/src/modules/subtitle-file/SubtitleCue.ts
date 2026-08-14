import type { TimeFragment } from '@modules/document/TimeFragment';
import type { SubtitleRow } from '@modules/subtitle-file/SubtitleRow';
import type { SubtitleToken } from '@modules/subtitle-file/SubtitleToken';

/**
 * One timed entry of a subtitle file: the window it occupies and the
 * rows shown inside it.
 *
 * A cue always covers a window of positive length and holds at least
 * one row. Text carries no markup — escaping and joining are format
 * concerns.
 */
export class SubtitleCue {
  constructor(
    readonly time: TimeFragment,
    readonly rows: ReadonlyArray<SubtitleRow>,
  ) {}

  tokens(): ReadonlyArray<SubtitleToken> {
    return this.rows.flatMap((row) => [...row.tokens]);
  }
}
