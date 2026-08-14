import { useCallback, useMemo, useRef, useState } from 'react';
import type { Document } from '@tscaps/engine';
import type { TimelineScaleResolver } from '@presentation/timeline/services/TimelineScaleResolver';
import type { TimelineZoom, TimelineZoomLimits } from '@presentation/timeline/services/TimelineZoom';

export interface TimelineZoomState {
  /** Seconds one row covers. Zero until the panel and the transcript are both real. */
  readonly rowDurationSec: number;
  /**
   * How close the reader is, against the scale the document opened at.
   * 100 is that opening scale, 200 is one press in from it.
   */
  readonly zoomPercent: number;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly canReset: boolean;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly reset: () => void;
}

/**
 * How many seconds a row covers, and the two presses that change it.
 *
 * The **opening** duration is decided the first time both the panel and
 * the transcript are real, and never revisited. It is read off the
 * document — an order statistic over every word's duration — which moves
 * whenever any one word is retimed, and re-slicing every row under the
 * user's hands is the failure that deciding once avoids.
 *
 * A press is the only other thing that moves it, and the limits are read
 * **at the press** rather than on every render, for the same reason: they
 * come from the document too, and a duration re-clamped behind the
 * reader's back would re-slice the panel with nobody having asked.
 */
export function useTimelineZoom(
  scaleResolver: TimelineScaleResolver,
  zoom: TimelineZoom,
  document: Document | null,
  panelWidthPx: number,
  videoDurationSec: number,
): TimelineZoomState {
  const openingSecRef = useRef(0);
  if (openingSecRef.current === 0 && document && panelWidthPx > 0) {
    const pxPerSecond = scaleResolver.defaultPxPerSecond(document, panelWidthPx, videoDurationSec);
    openingSecRef.current = scaleResolver.rowDurationSec(panelWidthPx, pxPerSecond);
  }

  const [pickedSec, setPickedSec] = useState<number | null>(null);
  const rowDurationSec = pickedSec ?? openingSecRef.current;

  const limits = useMemo<TimelineZoomLimits>(() => ({
    shortestSec: document ? scaleResolver.shortestRowDurationSec(document) : 0,
    longestSec: scaleResolver.longestRowDurationSec(videoDurationSec),
  }), [scaleResolver, document, videoDurationSec]);

  const zoomIn = useCallback(
    () => setPickedSec((current) => zoom.zoomedIn(current ?? openingSecRef.current, limits)),
    [zoom, limits],
  );
  const zoomOut = useCallback(
    () => setPickedSec((current) => zoom.zoomedOut(current ?? openingSecRef.current, limits)),
    [zoom, limits],
  );

  const openingSec = openingSecRef.current;
  return {
    rowDurationSec,
    zoomPercent: rowDurationSec > 0 && openingSec > 0
      ? Math.round((openingSec / rowDurationSec) * 100)
      : 100,
    canZoomIn: rowDurationSec > 0 && zoom.zoomedIn(rowDurationSec, limits) !== rowDurationSec,
    canZoomOut: rowDurationSec > 0 && zoom.zoomedOut(rowDurationSec, limits) !== rowDurationSec,
    canReset: pickedSec !== null && pickedSec !== openingSec,
    zoomIn,
    zoomOut,
    reset: () => setPickedSec(null),
  };
}
