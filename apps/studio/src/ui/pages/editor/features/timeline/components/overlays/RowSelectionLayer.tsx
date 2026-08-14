import { useTimelineSelection } from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';
import { SelectionOverlay } from '@ui/pages/editor/features/timeline/components/overlays/SelectionOverlay';

interface RowSelectionLayerProps {
  rowStartSec: number;
  rowEndSec: number;
}

/**
 * The slice of the current selection that falls inside one row.
 *
 * This layer listens for selection changes itself instead of the row
 * doing it, so a moving selection re-renders the layer alone and leaves
 * the row's chips and waveform untouched.
 *
 * The selection's actions are not here: they belong to the timeline,
 * which draws them once and can keep them on screen when the row
 * holding the moved edge is scrolled away.
 */
export function RowSelectionLayer({ rowStartSec, rowEndSec }: RowSelectionLayerProps) {
  const selection = useTimelineSelection();

  if (!selection) return null;
  if (selection.endSec <= rowStartSec || selection.startSec >= rowEndSec) return null;

  return (
    <SelectionOverlay
      selection={selection}
      rowStartSec={rowStartSec}
      rowDurationSec={rowEndSec - rowStartSec}
    />
  );
}
