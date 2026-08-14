import {
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import { useTimelineEditingController } from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';
import { useTimelinePointerDragController } from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import { useTimelineCutEdit } from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';
import { useLinkedCellHover } from '@ui/pages/editor/features/timeline/hooks/useLinkedCellHover';
import { percentage, pointerOrigin } from '@ui/pages/editor/features/timeline/utils';
import { CutPopover } from '@ui/pages/editor/features/timeline/components/CutPopover';

// The border colour is picked once further down rather than layered
// here: two utilities writing the same property have the same
// specificity, so the winner is whichever Tailwind emits last.
const CUT_OVERLAY_CLASS =
  'pointer-events-auto cursor-pointer border-y '
  + 'transition-colors duration-quick ease-standard '
  + 'backdrop-grayscale backdrop-brightness-[0.55]';

// An accent edge under the pointer is how the whole track says "this
// does something", shared with the word and silence chips.
const HOVER_CLASS = 'hover:border-accent';

const LINKED_BORDER_CLASS = 'border-accent';
const RESTING_BORDER_CLASS = 'border-edge-medium';

const START_EDGE_CLASS = 'border-l rounded-l-xs';

const END_EDGE_CLASS = 'border-r rounded-r-xs';

const CUT_OVERLAY_STYLE = {
  backgroundImage:
    'repeating-linear-gradient('
    + '135deg,'
    + 'rgb(var(--color-fg-faint) / 0.35) 0,'
    + 'rgb(var(--color-fg-faint) / 0.35) 4px,'
    + 'transparent 4px,'
    + 'transparent 9px'
    + ')',
} as const;

const CUT_RESIZE_HANDLE_CLASS = 'pointer-events-auto absolute top-0 bottom-0 w-2 -mx-1 cursor-ew-resize';

interface CutOverlayProps {
  cut: CutRange;
  rowStartSec: number;
  rowDurationSec: number;
  onRestore: () => void;
}

/**
 * Diagonal-hatched mask drawn over the portion of one row's timeline
 * that lives inside a cut range.
 *
 * Pressing it opens the cut's own menu, and drops any selection on the
 * way. It deliberately does not select the range itself: a selection is
 * a stretch of video to act on or to loop, and a cut is neither, being
 * time the video no longer has.
 *
 * Each edge handle anchors the opposite edge and routes the pointer
 * through the editing controller's cut-edit, so the mask draws the live
 * preview range until the gesture is released. Borders, corners and
 * handles only render on the side whose edge falls inside this row, so
 * a cut spanning several rows reads as one continuous mask, and
 * pointing at any part of it lights up the rest.
 */
export function CutOverlay({ cut, rowStartSec, rowDurationSec, onRestore }: CutOverlayProps) {
  const editingController = useTimelineEditingController();
  const dragController = useTimelinePointerDragController();
  const cutEdit = useTimelineCutEdit();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pressOffsetPx, setPressOffsetPx] = useState(0);
  const rowEndSec = rowStartSec + rowDurationSec;
  const isBeingEdited = cutEdit !== null && cutEdit.originalRange === cut;
  const displayRange = isBeingEdited ? cutEdit.range : cut;

  const visibleStart = Math.max(displayRange.startSec, rowStartSec);
  const visibleEnd = Math.min(displayRange.endSec, rowEndSec);
  const leftPct = percentage(visibleStart - rowStartSec, rowDurationSec);
  const widthPct = percentage(visibleEnd - visibleStart, rowDurationSec);

  const showStartEdge = displayRange.startSec >= rowStartSec && displayRange.startSec <= rowEndSec;
  const showEndEdge = displayRange.endSec >= rowStartSec && displayRange.endSec <= rowEndSec;

  // Stored cuts never overlap one another, so where a cut begins names
  // it. The stored range rather than the previewed one, so a cut being
  // resized keeps the identity its other pieces know it by.
  const cutId = `cut-${cut.startSec}`;
  const isSplit = !showStartEdge || !showEndEdge;
  const [isLinkedHover, hoverHandlers] = useLinkedCellHover(cutId, isSplit);

  // A cut dragged *out* of this row still has to be mounted here, so the
  // mask it was showing goes away — but its preview now ends before the
  // row begins, and the span would come out negative. Drawing nothing is
  // the honest answer; leaving it to invalid CSS was the previous one.
  if (visibleEnd <= visibleStart) return null;

  const startResizeFromAnchor = (anchorSec: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragController.beginCutEdgeDrag(cut, anchorSec, pointerOrigin(e));
  };

  // Nothing else drops the selection here: it is a mode that outlives a
  // press elsewhere, on purpose, because it can be played in a loop.
  // Left standing, its bar and this menu would sit on screen together,
  // offering to cut and to un-cut at the same time.
  const openMenu = (open: boolean) => {
    if (open) editingController.clearSelection();
    setMenuOpen(open);
  };

  // Recorded before the menu opens, in the mask's own coordinates, so
  // that a cut long enough to fill a row still puts its menu under the
  // pointer instead of at the far end of the row.
  const recordPressOffset = (e: ReactMouseEvent<HTMLDivElement>) => {
    setPressOffsetPx(e.clientX - e.currentTarget.getBoundingClientRect().left);
  };

  const className = [
    CUT_OVERLAY_CLASS,
    HOVER_CLASS,
    isLinkedHover ? LINKED_BORDER_CLASS : RESTING_BORDER_CLASS,
    showStartEdge ? START_EDGE_CLASS : '',
    showEndEdge ? END_EDGE_CLASS : '',
  ].filter(Boolean).join(' ');

  return (
    <CutPopover
      open={menuOpen}
      onOpenChange={openMenu}
      durationSec={cut.endSec - cut.startSec}
      pressOffsetPx={pressOffsetPx}
      onRestore={onRestore}
      trigger={(
        <div
          className={className}
          style={{ ...CUT_OVERLAY_STYLE, position: 'absolute', left: leftPct, width: widthPct, top: 0, bottom: 0 }}
          title="Options for this cut"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={recordPressOffset}
          {...hoverHandlers}
        >
          {showStartEdge && (
            <div
              className={CUT_RESIZE_HANDLE_CLASS}
              style={{ left: 0 }}
              title="Drag to resize cut"
              aria-label="Resize cut start"
              onPointerDown={startResizeFromAnchor(cut.endSec)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {showEndEdge && (
            <div
              className={CUT_RESIZE_HANDLE_CLASS}
              style={{ right: 0 }}
              title="Drag to resize cut"
              aria-label="Resize cut end"
              onPointerDown={startResizeFromAnchor(cut.startSec)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    />
  );
}
