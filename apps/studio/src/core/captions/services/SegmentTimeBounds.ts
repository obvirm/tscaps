import type { Document, Section, Segment } from '@tscaps/engine';
import type { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import type { WordTimeLimits } from '@core/captions/services/WordTimeBounds';

/**
 * The widest window each segment may occupy: clear of the hard time of
 * every segment sharing its sheet, and inside the video.
 *
 * **Only same-sheet segments are walls.** Two segments on different
 * sheets are meant to be able to claim the same instant — that is how a
 * caption and its translation, or a caption and a standing line, are
 * said at once — and each of those sheets is read in a channel of its
 * own. Inside one sheet there is no such thing: a sheet is one channel
 * and a channel is one sequence, so two of its segments sharing an
 * instant would be two texts with nowhere to draw the second.
 *
 * A sheet's segments are gathered from every section carrying it, not
 * only the one holding a given segment: routing a segment in the middle
 * of a document to another sheet splits its section in three, so one
 * sheet routinely spans several.
 *
 * The video's own ends are the outer wall — time outside them is never
 * rendered, so anything pushed past either end is content the export can
 * only drop. A duration of zero means the length is not known yet and
 * leaves the far end open.
 */
export class SegmentTimeBounds {

  constructor(private readonly hardTime: SegmentHardTime) {}

  /** Every segment's limits, by id, in one pass over the document. */
  allLimits(document: Document, videoDurationSec: number): ReadonlyMap<string, WordTimeLimits> {
    const videoEndSec = videoDurationSec > 0 ? videoDurationSec : Number.POSITIVE_INFINITY;
    const limits = new Map<string, WordTimeLimits>();
    for (const segments of this.sheets(document).values()) {
      segments.forEach((segment, index) => {
        limits.set(segment.id, {
          earliestStartSec: this.hardEndOf(segments[index - 1]),
          latestEndSec: Math.min(videoEndSec, this.hardStartOf(segments[index + 1])),
        });
      });
    }
    return limits;
  }

  /**
   * One segment's limits. Wide open for a segment the document does not
   * hold, which is the safe answer: the caller's own clamping still
   * applies and nothing is silently narrowed.
   */
  limitsFor(document: Document, segmentId: string, videoDurationSec: number): WordTimeLimits {
    const videoEndSec = videoDurationSec > 0 ? videoDurationSec : Number.POSITIVE_INFINITY;
    return this.allLimits(document, videoDurationSec).get(segmentId)
      ?? { earliestStartSec: 0, latestEndSec: videoEndSec };
  }

  private sheets(document: Document): ReadonlyMap<string, Segment[]> {
    const bySheetId = new Map<string, Segment[]>();
    for (const section of document.sections) this.collect(section, bySheetId);
    return bySheetId;
  }

  private collect(section: Section, bySheetId: Map<string, Segment[]>): void {
    const existing = bySheetId.get(section.kind);
    if (existing) existing.push(...section.segments);
    else bySheetId.set(section.kind, [...section.segments]);
  }

  private hardEndOf(previous: Segment | undefined): number {
    if (!previous) return 0;
    return this.hardTime.of(previous)?.end ?? 0;
  }

  private hardStartOf(next: Segment | undefined): number {
    if (!next) return Number.POSITIVE_INFINITY;
    return this.hardTime.of(next)?.start ?? Number.POSITIVE_INFINITY;
  }
}
