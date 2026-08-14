import type { TimelineGapCell } from '@presentation/timeline/services/TimelineProjection';
import { useLinkedCellHover } from '@ui/pages/editor/features/timeline/hooks/useLinkedCellHover';
import { cellPieceStyle } from '@ui/pages/editor/features/timeline/utils';

// The same shape as a word chip, so the lane stays visible around it,
// and recessed rather than raised: a word sits above the lane and a
// silence below it, which is the whole hierarchy in one look. Opaque,
// so it cuts the scene wash behind it instead of being tinted by it —
// anything showing through reads as a stain on a scene rather than as a
// hole in the video.
//
// The border colour is picked once further down rather than layered
// here: two utilities writing the same property have the same
// specificity, so the winner is whichever Tailwind emits last.
//
// The inset lives on the label, not here. `box-sizing: border-box`
// floors the used width at padding plus border, so a chip carrying them
// cannot draw narrower than their sum.
const GAP_CHIP_CLASS =
  'pointer-events-auto flex items-center border border-dashed overflow-hidden cursor-pointer '
  + 'bg-surface-0 text-2xs font-mono text-fg-muted '
  + 'transition-colors duration-quick ease-standard';

// An accent edge under the pointer is how the whole track says "this
// does something", shared with the word chips and the cut masks.
const HOVER_CLASS = 'hover:border-accent hover:text-fg-secondary';

const LINKED_BORDER_CLASS = 'border-accent';
const RESTING_BORDER_CLASS = 'border-edge-strong';

// Cut by a row boundary: the side loses its corner and its edge, so the
// silence reads as carrying on rather than ending there.
const OPEN_START_CLASS = 'rounded-l-none border-l-0';
const OPEN_END_CLASS = 'rounded-r-none border-r-0';

const CHIP_TEXT_CLASS = 'w-full min-w-0 px-1 truncate text-center';

interface GapChipProps {
  cell: TimelineGapCell;
  rowStartSec: number;
  rowDurationSec: number;
  onSelect: (startSec: number, endSec: number) => void;
}

/**
 * A silence in the narration, positioned by its time inside the row
 * that draws it. Clicking selects the whole silence however many rows
 * it crosses, and pointing at any piece of it lights up all of them.
 *
 * Only the widest piece is labelled: the duration belongs to the
 * silence, not to the part of it one row happens to hold, and printing
 * it twice would state a length neither piece has.
 */
export function GapChip({ cell, rowStartSec, rowDurationSec, onSelect }: GapChipProps) {
  const isSplit = cell.cutAtStart || cell.cutAtEnd;
  const [isLinkedHover, hoverHandlers] = useLinkedCellHover(cell.id, isSplit);
  const seconds = cell.fullEndSec - cell.fullStartSec;

  const classes = [
    GAP_CHIP_CLASS,
    HOVER_CLASS,
    cell.cutAtStart ? OPEN_START_CLASS : 'rounded-l-xs',
    cell.cutAtEnd ? OPEN_END_CLASS : 'rounded-r-xs',
    isLinkedHover ? LINKED_BORDER_CLASS : RESTING_BORDER_CLASS,
  ].join(' ');

  return (
    <span
      className={classes}
      style={cellPieceStyle(cell, rowStartSec, rowDurationSec)}
      title={`Silence ${seconds.toFixed(2)}s`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onSelect(cell.fullStartSec, cell.fullEndSec)}
      {...hoverHandlers}
    >
      {cell.isWidestPiece && <span className={CHIP_TEXT_CLASS}>{seconds.toFixed(1)}s</span>}
    </span>
  );
}
