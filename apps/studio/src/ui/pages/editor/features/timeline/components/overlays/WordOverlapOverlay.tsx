import type { TimelineOverlapSpan } from '@presentation/timeline/services/TimelineProjection';
import { percentage } from '@ui/pages/editor/features/timeline/utils';

// Never intercepts the pointer: it lies over the very edges the user
// has to grab to pull the two words apart again.
//
// Only the sides are drawn, and they land exactly on the two edges that
// cross — the second word's start and the first word's end — which puts
// back the one the upper chip was hiding.
const OVERLAP_CLASS = 'pointer-events-none border-x border-warning bg-warning/15';

// A faint mesh in the marking's own tone rather than grey, so the
// stretch carries texture without becoming a second colour.
const OVERLAP_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(45deg,'
    + 'rgb(var(--color-warning) / 0.35) 0, rgb(var(--color-warning) / 0.35) 1px,'
    + 'transparent 1px, transparent 5px),'
    + 'repeating-linear-gradient(-45deg,'
    + 'rgb(var(--color-warning) / 0.35) 0, rgb(var(--color-warning) / 0.35) 1px,'
    + 'transparent 1px, transparent 5px)',
} as const;

// Just inside the chips' own border, so the outlines above and below
// stay untouched.
const CHIP_BORDER_PX = 1;

interface WordOverlapOverlayProps {
  overlaps: ReadonlyArray<TimelineOverlapSpan>;
  rowStartSec: number;
  rowDurationSec: number;
}

/**
 * Marks the stretches where two consecutive words both claim the time,
 * so a pair that will light up together is visible without having to
 * play the video.
 *
 * It carries a warning tone rather than a neutral one: overlapping
 * words are legal and sometimes wanted, but they are worth noticing
 * before an export rather than after.
 */
export function WordOverlapOverlay({
  overlaps,
  rowStartSec,
  rowDurationSec,
}: WordOverlapOverlayProps) {
  return (
    <>
      {overlaps.map((span) => (
        <div
          key={`${span.startSec.toFixed(3)}-${span.endSec.toFixed(3)}`}
          className={OVERLAP_CLASS}
          style={{
            ...OVERLAP_STYLE,
            position: 'absolute',
            left: percentage(span.startSec - rowStartSec, rowDurationSec),
            width: percentage(span.endSec - span.startSec, rowDurationSec),
            top: CHIP_BORDER_PX,
            bottom: CHIP_BORDER_PX,
          }}
        />
      ))}
    </>
  );
}
