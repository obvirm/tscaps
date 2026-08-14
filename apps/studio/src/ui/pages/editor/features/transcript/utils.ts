import type { Segment } from '@tscaps/engine';
import type { WordTimeLimits } from '@core/captions/services/WordTimeBounds';

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ds = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ds}`;
}

export interface WordTimeBounds {
  readonly prevEnd: number;
  readonly nextStart: number;
}

/**
 * Visual slider stops for a single word's timing edit. Inside the segment
 * the stops are the adjacent non-empty words; at either edge there is no
 * such word and `outer` is the stop.
 *
 * `outer` is the window the whole segment is held to — its same-sheet
 * neighbours' hard time and the video's ends — which is the same wall the
 * edit itself is clamped to. Reading it from here rather than working it
 * out again is what keeps the slider from offering a value the edit would
 * then pull back. It used to stop at the neighbouring segment's *drawn*
 * window instead, which is padding: derived, re-stamped after every edit,
 * and not a boundary anyone chose.
 */
export function wordTimeBoundsInSegment(
  segment: Segment,
  wordId: string,
  outer: WordTimeLimits,
): WordTimeBounds {
  const flat = segment.lines.flatMap((l) => l.words);
  const idx = flat.findIndex((w) => w.id === wordId);
  if (idx < 0) {
    return { prevEnd: segment.time.start, nextStart: segment.time.end };
  }

  let prevEnd: number | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    const w = flat[i]!;
    if (w.text.length > 0) { prevEnd = w.time.end; break; }
  }
  let nextStart: number | null = null;
  for (let i = idx + 1; i < flat.length; i++) {
    const w = flat[i]!;
    if (w.text.length > 0) { nextStart = w.time.start; break; }
  }

  return {
    prevEnd: prevEnd ?? outer.earliestStartSec,
    // An unmeasured video leaves the far wall open, and a slider cannot
    // be drawn against infinity: the segment's own end stands in.
    nextStart: nextStart
      ?? (Number.isFinite(outer.latestEndSec) ? outer.latestEndSec : segment.time.end),
  };
}
