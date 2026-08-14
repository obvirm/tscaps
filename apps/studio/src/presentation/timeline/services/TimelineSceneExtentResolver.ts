import type { Segment } from '@tscaps/engine';

/** The stretch of time the timeline draws for one scene. */
export interface TimelineSceneExtent {
  readonly segment: Segment;
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * Where each scene runs on the timeline, in ascending start order.
 *
 * The stretch a scene occupies is its window *and* its words: a manual
 * time edit can shrink the window past the words it holds, and those
 * words are still drawn.
 *
 * Scenes are free to overlap and nothing here separates them, because
 * nothing downstream has to choose between two of them: segments of one
 * sheet are kept from sharing an instant, and sheets that share one are
 * read in channels of their own.
 */
export class TimelineSceneExtentResolver {

  /** Ties on start are broken by the earlier end. */
  resolve(segments: ReadonlyArray<Segment>): TimelineSceneExtent[] {
    return segments
      .map((segment) => this.extentOf(segment))
      .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);
  }

  private extentOf(segment: Segment): TimelineSceneExtent {
    const words = segment.getWords();
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    const time = segment.time;
    return {
      segment,
      startSec: firstWord ? Math.min(time.start, firstWord.time.start) : time.start,
      endSec: lastWord ? Math.max(time.end, lastWord.time.end) : time.end,
    };
  }
}
