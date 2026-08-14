import {
  useTimelineCellHoverController,
  useTimelineCellHovered,
} from '@ui/pages/editor/features/timeline/contexts/TimelineCellHoverContext';

interface LinkedCellHoverHandlers {
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

/**
 * Whether the pointer is over the cell anywhere the timeline drew it,
 * along with the handlers that publish it. Spread the handlers onto the
 * element carrying the cell.
 *
 * `shared` off means the answer is always false and nothing subscribes.
 * Pass it for anything that only needs the hover CSS already gives it:
 * hovering is a stream of events over a track holding hundreds of
 * chips, and a cell drawn once has no sibling to light up.
 */
export function useLinkedCellHover(
  cellId: string,
  shared: boolean,
): [boolean, LinkedCellHoverHandlers] {
  const controller = useTimelineCellHoverController();
  const isHovered = useTimelineCellHovered(cellId, shared);
  if (!shared) return [false, {}];
  return [isHovered, {
    onPointerEnter: () => controller.hover(cellId),
    onPointerLeave: () => controller.clear(cellId),
  }];
}
