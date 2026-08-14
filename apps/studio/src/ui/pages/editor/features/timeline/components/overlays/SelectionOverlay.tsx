import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TimelineSelection } from '@presentation/timeline/controllers/TimelineEditingController';
import { useTimelinePointerDragController } from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import { percentage, pointerOrigin } from '@ui/pages/editor/features/timeline/utils';

const SELECTION_OVERLAY_CLASS = 'bg-accent/25 border-y border-accent/60';

const START_EDGE_CLASS = 'border-l rounded-l-xs';

const END_EDGE_CLASS = 'border-r rounded-r-xs';

const RESIZE_HANDLE_CLASS = 'pointer-events-auto absolute top-0 bottom-0 w-2 -mx-1 cursor-ew-resize';

interface SelectionOverlayProps {
  selection: TimelineSelection;
  rowStartSec: number;
  rowDurationSec: number;
}

/**
 * Translucent rectangle marking the selected time range inside one
 * row's timeline. A selection may span several rows, so the
 * rectangle is clipped to this row's bounds and only the edges that
 * actually fall inside the row get a border, a rounded corner and a
 * resize handle — the middle rows render as an uninterrupted band.
 *
 * Each handle anchors the opposite edge and hands the pointer to the
 * drag controller, which carries the gesture on from there — including
 * across rows.
 */
export function SelectionOverlay({ selection, rowStartSec, rowDurationSec }: SelectionOverlayProps) {
  const dragController = useTimelinePointerDragController();
  const rowEndSec = rowStartSec + rowDurationSec;

  const visibleStart = Math.max(selection.startSec, rowStartSec);
  const visibleEnd = Math.min(selection.endSec, rowEndSec);
  const leftPct = percentage(visibleStart - rowStartSec, rowDurationSec);
  const widthPct = percentage(visibleEnd - visibleStart, rowDurationSec);

  const showStartEdge = selection.startSec >= rowStartSec && selection.startSec <= rowEndSec;
  const showEndEdge = selection.endSec >= rowStartSec && selection.endSec <= rowEndSec;

  const startResizeFromAnchor = (anchorSec: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragController.beginSelectionEdgeDrag(anchorSec, pointerOrigin(e));
  };

  const className = [
    SELECTION_OVERLAY_CLASS,
    showStartEdge ? START_EDGE_CLASS : '',
    showEndEdge ? END_EDGE_CLASS : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      style={{ position: 'absolute', left: leftPct, width: widthPct, top: 0, bottom: 0 }}
    >
      {showStartEdge && (
        <div
          className={RESIZE_HANDLE_CLASS}
          style={{ left: 0 }}
          title="Drag to resize selection"
          aria-label="Resize selection start"
          onPointerDown={startResizeFromAnchor(selection.endSec)}
        />
      )}
      {showEndEdge && (
        <div
          className={RESIZE_HANDLE_CLASS}
          style={{ right: 0 }}
          title="Drag to resize selection"
          aria-label="Resize selection end"
          onPointerDown={startResizeFromAnchor(selection.startSec)}
        />
      )}
    </div>
  );
}
