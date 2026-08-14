import { useCallback, useEffect, useSyncExternalStore, type MouseEvent } from 'react';
import type {
  OverlaySelection,
  OverlayPopoverAnchor,
  OverlaySelectionController,
} from '@presentation/editor/controllers/OverlaySelectionController';

export type Selection = OverlaySelection;
export type PopoverAnchor = OverlayPopoverAnchor;

export interface SegmentSelection {
  /** What the user picked, whether or not it is on screen right now. */
  selection: Selection;
  /** The same pick, narrowed to when its segment is being painted. Chrome that measures a DOM node needs this one. */
  paintedSelection: Selection;
  popover: PopoverAnchor;
  setSelection: (next: Selection) => void;
  closePopover: () => void;
  onClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
}

/**
 * Reads the overlay's current selection and right-click popover anchor
 * from the controller and exposes the click handlers the overlay
 * attaches to its scaler.
 *
 * The selection outlives the segment leaving `activeSegmentIds` — the
 * playhead crossing a scene boundary does not mean the user is done with
 * the word they picked. What the playhead does control is whether the
 * element is painted, so that narrowing is a second value rather than a
 * shorter lifetime.
 *
 * `activeSegmentIds` is handed to the controller rather than applied
 * here: panels outside the preview need the same narrowing, and two
 * places deciding it separately is two places to disagree from.
 */
export function useSegmentSelection(
  activeSegmentIds: ReadonlySet<string>,
  controller: OverlaySelectionController,
): SegmentSelection {
  const subscribe = useCallback((notify: () => void) => controller.subscribe(notify), [controller]);
  const selection = useSyncExternalStore(subscribe, () => controller.selectionSnapshot());
  const paintedSelection = useSyncExternalStore(subscribe, () => controller.paintedSelectionSnapshot());
  const popover = useSyncExternalStore(subscribe, () => controller.popoverSnapshot());

  useEffect(
    () => controller.setPaintedSegmentIds(activeSegmentIds),
    [controller, activeSegmentIds],
  );

  const setSelection = useCallback(
    (next: Selection) => controller.setSelection(next),
    [controller],
  );
  const closePopover = useCallback(() => controller.closePopover(), [controller]);

  const onClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const scaler = event.currentTarget as HTMLElement;
    controller.selectAtPoint(target, scaler, event.clientX, event.clientY, false);
  }, [controller]);

  const onContextMenu = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const scaler = event.currentTarget as HTMLElement;
    if (!controller.selectAtPoint(target, scaler, event.clientX, event.clientY, true)) return;
    event.preventDefault();
  }, [controller]);

  return { selection, paintedSelection, popover, setSelection, closePopover, onClick, onContextMenu };
}
