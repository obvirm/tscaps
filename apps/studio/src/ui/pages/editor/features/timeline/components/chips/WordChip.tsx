import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  TimelineWordDragMode,
  TimelineWordDragTarget,
} from '@presentation/timeline/controllers/gestures/TimelineWordEditGesture';
import type { TimelineWordCell } from '@presentation/timeline/services/TimelineProjection';
import { useTimelinePointerDragController } from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import { useLinkedCellHover } from '@ui/pages/editor/features/timeline/hooks/useLinkedCellHover';
import { cellPieceStyle, pointerOrigin } from '@ui/pages/editor/features/timeline/utils';

// Outlined rather than a bare fill: an edge is what makes two words
// pressed against each other — or crossing — read as two things.
//
// The border colour and the fill are picked once further down rather
// than layered here: two utilities writing the same property have the
// same specificity, so the winner is whichever Tailwind emits last.
//
// The inset lives on the text, not here. `box-sizing: border-box`
// floors the used width at padding plus border, so a chip carrying
// them cannot draw narrower than their sum.
const WORD_CHIP_CLASS =
  'flex items-center border overflow-hidden '
  + 'text-xs font-medium '
  + 'transition-colors duration-quick ease-standard';

const LIVE_CHIP_CLASS = 'cursor-grab active:cursor-grabbing';

// Lifted and inert while it is being moved: it reads as picked up off
// the track and never takes the pointer that is already captured
// elsewhere driving it.
const PREVIEW_CHIP_CLASS = 'shadow-md z-10 pointer-events-none';

// A side that was cut loses its corner and its edge, which is what says
// the word carries on somewhere else — the next row, or under the scene
// that took the rest of it.
const OPEN_START_CLASS = 'rounded-l-none border-l-0';
const OPEN_END_CLASS = 'rounded-r-none border-r-0';

// An accent edge under the pointer is how the whole track says "this
// does something", shared with the silence chips and the cut masks.
const HOVER_CLASS = 'hover:border-accent hover:bg-surface-3';

const LINKED_BORDER_CLASS = 'border-accent';
const RESTING_BORDER_CLASS = 'border-edge-strong';

// Translucent at rest so a word crossing another shows it through;
// opaque once it is the one being pointed at or dragged.
const RESTING_FILL_CLASS = 'bg-surface-3/80';
const RAISED_FILL_CLASS = 'bg-surface-3';

const CHIP_TEXT_CLASS = 'w-full min-w-0 px-1 truncate text-center';

// Where two words cross, the one drawn second covers the other's edge
// and with it the only place to grab that edge. Raising both words'
// handles keeps them reachable inside the shared stretch; a chip is
// positioned but has no stacking context, so this reaches its siblings.
const RESIZE_HANDLE_CLASS = 'absolute top-0 bottom-0 w-2 z-10 cursor-ew-resize';

interface WordChipProps {
  cell: TimelineWordCell;
  rowStartSec: number;
  rowDurationSec: number;
  /** Absent on a chip that is only the live preview of a word being dragged. */
  dragTarget: TimelineWordDragTarget | null;
}

/**
 * One word on the timeline, positioned by its time inside the row that
 * draws it.
 *
 * A word longer than a row is cut into a piece per row, and each piece
 * is a chip of its own: it carries the word's letters, opens the side
 * it was cut on so the two read as one word wrapped rather than two
 * words, and lights up with its siblings when any of them is pointed
 * at. Each resize handle only appears on the piece holding the edge it
 * moves.
 *
 * With a `dragTarget`, dragging the body slides the word, the edge
 * handles stretch it, and a press that never travels selects its span.
 * Without one the chip is the live preview of a word being dragged, and
 * it only draws.
 */
export function WordChip({ cell, rowStartSec, rowDurationSec, dragTarget }: WordChipProps) {
  const dragController = useTimelinePointerDragController();
  const isSplit = cell.cutAtStart || cell.cutAtEnd;
  const [isLinkedHover, hoverHandlers] = useLinkedCellHover(cell.id, isSplit);

  const startEdit = (mode: TimelineWordDragMode) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !dragTarget) return;
    e.stopPropagation();
    dragController.beginWordEdit(dragTarget, mode, pointerOrigin(e));
  };

  const isRaised = isLinkedHover || dragTarget === null;
  const classes = [
    WORD_CHIP_CLASS,
    dragTarget ? `${LIVE_CHIP_CLASS} ${HOVER_CLASS}` : PREVIEW_CHIP_CLASS,
    cell.cutAtStart ? OPEN_START_CLASS : 'rounded-l-xs',
    cell.cutAtEnd ? OPEN_END_CLASS : 'rounded-r-xs',
    'text-fg-primary',
    isLinkedHover ? LINKED_BORDER_CLASS : RESTING_BORDER_CLASS,
    isRaised ? RAISED_FILL_CLASS : RESTING_FILL_CLASS,
  ].join(' ');

  return (
    <span
      className={classes}
      style={cellPieceStyle(cell, rowStartSec, rowDurationSec)}
      title={cell.text}
      onPointerDown={startEdit('move')}
      {...hoverHandlers}
    >
      <span className={CHIP_TEXT_CLASS}>{cell.text}</span>
      {dragTarget && !cell.cutAtStart && (
        <span
          className={RESIZE_HANDLE_CLASS}
          style={{ left: 0 }}
          title="Drag to change when this word starts"
          aria-label="Resize word start"
          onPointerDown={startEdit('resize-start')}
        />
      )}
      {dragTarget && !cell.cutAtEnd && (
        <span
          className={RESIZE_HANDLE_CLASS}
          style={{ right: 0 }}
          title="Drag to change when this word ends"
          aria-label="Resize word end"
          onPointerDown={startEdit('resize-end')}
        />
      )}
    </span>
  );
}
