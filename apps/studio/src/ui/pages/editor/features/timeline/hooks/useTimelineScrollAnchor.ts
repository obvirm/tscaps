import { useLayoutEffect, useMemo } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { TimelineScrollAnchor } from '@presentation/timeline/services/TimelineScrollAnchor';

interface TimelineScrollAnchorParams {
  virtualizer: Virtualizer<HTMLElement, Element>;
  /** Seconds one row covers. Changing it re-slices every row. */
  rowDurationSec: number;
  /** What a row reserves in the list, rows all being the same height. */
  rowHeightPx: number;
}

/**
 * Keeps the reader looking at the same part of the video when the rows
 * are re-sliced or redrawn at another height.
 *
 * The offset is read while rendering rather than from the effect,
 * because by the time an effect runs the rows have already been given
 * their new size and the offset no longer means what it did.
 */
export function useTimelineScrollAnchor({
  virtualizer,
  rowDurationSec,
  rowHeightPx,
}: TimelineScrollAnchorParams): void {
  const anchor = useMemo(() => new TimelineScrollAnchor(), []);
  anchor.track(virtualizer.scrollOffset ?? 0, { durationSec: rowDurationSec, heightPx: rowHeightPx });

  useLayoutEffect(() => {
    const offsetPx = anchor.restore({ durationSec: rowDurationSec, heightPx: rowHeightPx });
    if (offsetPx === null) return;
    virtualizer.scrollToOffset(offsetPx, { align: 'start', behavior: 'auto' });
  }, [anchor, virtualizer, rowDurationSec, rowHeightPx]);
}
