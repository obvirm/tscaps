import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { SegmentSelectionChrome } from '@ui/pages/editor/features/overlay/components/segments/SegmentSelectionChrome';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';

interface SegmentDropTargetChromeProps {
  sheetBySegmentId: ReadonlyMap<string, Sheet>;
  elementStyles: ElementStyles;
  /** The overlay scaler the chrome is mounted in and measured against. */
  scaler: HTMLElement | null;
}

/**
 * Drop-zone highlight for the segment that would take a dragged word
 * back into flow on release. Subscribes to the drag state itself so
 * only this component re-renders on drag ticks, and renders nothing
 * outside a word drag with a live drop target.
 */
export function SegmentDropTargetChrome({
  sheetBySegmentId,
  elementStyles,
  scaler,
}: SegmentDropTargetChromeProps) {
  const dragState = useOverlayDragState();
  if (dragState?.kind !== 'word' || dragState.dropTargetSegmentId === null) return null;
  const segmentId = dragState.dropTargetSegmentId;
  const sheet = sheetBySegmentId.get(segmentId);
  if (!sheet) return null;
  return (
    <SegmentSelectionChrome
      segmentId={segmentId}
      sheet={sheet}
      elementStyles={elementStyles}
      scaler={scaler}
      variant="drop-target"
    />
  );
}
