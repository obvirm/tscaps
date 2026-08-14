export interface WordTimeRange {
  readonly startSec: number;
  readonly endSec: number;
}

export interface WordTimeLimits {
  readonly earliestStartSec: number;
  readonly latestEndSec: number;
}

// A word narrower than a single frame at 60 fps can never have its
// narrated state painted, so it is the floor below which a duration
// stops meaning anything.
const MIN_WORD_DURATION_SEC = 1 / 60;

/**
 * Keeps a word's time inside the order its neighbours already
 * establish — it may share time with them, but never trade places —
 * and inside whatever wall its segment is held to.
 *
 * This is a domain rule, not a matter of taste. A line reports its own
 * window as `words[0].start → words[last].end`, taken by position in
 * the array rather than by time. Let a word start before the one
 * ahead of it and the line — and through it the segment — reports a
 * window that does not cover it, so the caption shows up after the
 * word has already begun to narrate, with nothing to warn anyone.
 * Keeping starts and ends non-decreasing is what makes those two
 * ends the true extremes.
 *
 * Words *within* one segment may overlap and are left alone. Two words
 * narrating at once is a legitimate thing to ask for, and other edits
 * in the editor treat it the same way. What a word may not do is carry
 * its segment past the wall, which is why the wall is handed in rather
 * than assumed: the same rule then holds wherever it is asked from.
 */
export class WordTimeBounds {

  /**
   * The widest span the word at `index` may occupy: inside its
   * neighbours' order and inside `outer`. Times are read by array
   * position, so empty words count: they sit in the line like any
   * other.
   *
   * `outer` is the window the whole segment is held to — its
   * same-sheet neighbours and the video's ends. A word at either end of
   * the segment has no neighbour to stop it, so that wall is the only
   * thing that does.
   */
  limitsAt(
    words: ReadonlyArray<WordTimeRange>,
    index: number,
    outer: WordTimeLimits,
  ): WordTimeLimits {
    const previous = words[index - 1];
    const next = words[index + 1];
    return {
      earliestStartSec: Math.max(outer.earliestStartSec, previous ? previous.startSec : -Infinity),
      latestEndSec: Math.min(outer.latestEndSec, next ? next.endSec : Infinity),
    };
  }

  /**
   * Pulls `proposed` inside `limits`, keeping the word at least one
   * frame long. When the limits are tighter than that floor, the start
   * wins and the word keeps its minimum length.
   */
  clamp(proposed: WordTimeRange, limits: WordTimeLimits): WordTimeRange {
    const startSec = Math.max(proposed.startSec, limits.earliestStartSec);
    const endSec = Math.min(proposed.endSec, limits.latestEndSec);
    return { startSec, endSec: Math.max(endSec, startSec + MIN_WORD_DURATION_SEC) };
  }

  /**
   * Slides a span to begin at `proposedStartSec` without changing its
   * length, stopping at whichever limit it reaches first. Dragging a
   * word bodily is this, not two independent edges: squashing it
   * against a wall would lose the length the user is carrying.
   */
  shift(current: WordTimeRange, proposedStartSec: number, limits: WordTimeLimits): WordTimeRange {
    const durationSec = Math.max(current.endSec - current.startSec, MIN_WORD_DURATION_SEC);
    const latestStartSec = limits.latestEndSec - durationSec;
    const startSec = Math.min(Math.max(proposedStartSec, limits.earliestStartSec), latestStartSec);
    return { startSec, endSec: startSec + durationSec };
  }
}
