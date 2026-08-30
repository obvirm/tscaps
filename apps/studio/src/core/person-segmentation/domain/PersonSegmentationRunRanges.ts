import type { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';

/**
 * The two answers a run is asked for, which cover different stretches
 * on purpose.
 *
 * `toScan` is wider: a scene qualifies on how long it stays steady, so
 * judging the shot a caption sits in means looking past the caption.
 * `toCapture` is where masks are worth the cost — only where a caption
 * will actually be painted, since a mask outside one is never read.
 *
 * `toCapture` is expected to lie inside `toScan`; masks are only
 * captured where the scan found a usable scene anyway.
 */
export interface PersonSegmentationRunRanges {
  readonly toScan: TimeRangeSet;
  readonly toCapture: TimeRangeSet;
}
