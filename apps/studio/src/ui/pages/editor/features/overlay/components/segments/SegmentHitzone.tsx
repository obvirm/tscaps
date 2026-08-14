import { memo, useRef } from 'react';
import type { ChromeGeometry } from '@presentation/editor/services/OverlayChromeSource';
import { applyChromeGeometry } from '@ui/pages/editor/features/overlay/chromeGeometry';
import { findSegmentElement, measureSegmentChrome } from '@ui/pages/editor/features/overlay/segmentElementProbe';
import { useChromeReposition } from '@ui/pages/editor/features/overlay/hooks/useChromeReposition';

interface SegmentHitzoneProps {
  segmentId: string;
  /** The overlay scaler the chrome is mounted in and measured against. */
  scaler: HTMLElement | null;
}

const HORIZONTAL_CORONA_PX = 32;
const VERTICAL_CORONA_PX = 22;

/**
 * The segment's clickable surface: an invisible ghost sized to the
 * caption content box plus a `HORIZONTAL_CORONA_PX` /
 * `VERTICAL_CORONA_PX` corona, matching the visible selection chrome.
 * The engine's structural elements are pointer-transparent (words
 * re-arm as leaf targets), so every segment-level hit — interior gaps,
 * template padding, the corona around the text — lands here.
 *
 * Cannot live inside the segment subtree: templates are free to set
 * `overflow: hidden` on `.segment` (e.g. to clip an animated
 * `clip-path`), which would clip the enlarged reach, and
 * `rendering.padding` safety-bleed would inflate the clickable box
 * past the visible text. Mounted at the scaler level, the hitzone is
 * a sibling of the caption tree, so no template style can reshape it.
 *
 * Geometry comes from `CaptionContentBoxMeasurer`, so engine-injected
 * safety-bleed and template CSS padding do not inflate the click zone.
 * Carries `data-tscaps-segment-id`: selection resolves it via
 * `closest`, and the scaler's delegated pointerdown starts a segment
 * drag from it. Paints below the caption in tree order, so word hits
 * still resolve to the word.
 */
export const SegmentHitzone = memo(function SegmentHitzone({ segmentId, scaler }: SegmentHitzoneProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useChromeReposition({
    boxRef,
    scaler,
    targetId: segmentId,
    resolveTarget: findSegmentElement,
    measure: measureHitzone,
    apply: applyChromeGeometry,
  });

  return (
    <div
      ref={boxRef}
      className="subtitle-overlay-segment-hitzone"
      data-tscaps-segment-id={segmentId}
      aria-hidden
    />
  );
});

function measureHitzone(segment: HTMLElement, scaler: HTMLElement): ChromeGeometry {
  return measureSegmentChrome(segment, scaler, HORIZONTAL_CORONA_PX, VERTICAL_CORONA_PX);
}
