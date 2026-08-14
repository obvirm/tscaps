import { useCallback, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

// Pointer travel tolerated before a press counts as a drag. Below it, a
// shaky click on the dismiss button is still a click.
const DRAG_SLOP_PX = 4;

// Share of the element's own width the drag has to cover to dismiss.
// Expressed as a ratio so the gesture asks for the same effort from a
// one-line toast as from a wide one.
const DISMISS_TRAVEL_RATIO = 0.25;

interface SwipeGesture {
  readonly startX: number;
  readonly widthPx: number;
}

interface SwipeState {
  readonly offsetPx: number;
  /** How far along the dismissal the drag is, `0` to `1`. */
  readonly progress: number;
}

interface SwipeHandlers {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: () => void;
  readonly onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

interface SwipeToDismiss {
  /** Horizontal displacement to render, in px. `0` at rest. */
  readonly offsetPx: number;
  /** Opacity to render, fading as the drag approaches the dismissal. */
  readonly opacity: number;
  readonly dragging: boolean;
  readonly handlers: SwipeHandlers;
}

/**
 * Turns a horizontal pointer drag on an element into a dismissal.
 *
 * The element follows the pointer and fades as it travels; released past
 * a quarter of its own width it dismisses, and short of that it returns
 * to rest. Either direction works, so the gesture needs no aim.
 *
 * Clicks that land after a real drag are swallowed, so flicking an
 * element by its own buttons does not also press them. The caller owns
 * the rendering: apply `offsetPx` and `opacity`, and suppress its
 * transition while `dragging` so the element tracks the pointer exactly.
 */
export function useSwipeToDismiss(onDismiss: () => void): SwipeToDismiss {
  const [swipe, setSwipe] = useState<SwipeState | null>(null);
  const gestureRef = useRef<SwipeGesture | null>(null);
  const draggedRef = useRef(false);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    gestureRef.current = { startX: event.clientX, widthPx: event.currentTarget.getBoundingClientRect().width };
    draggedRef.current = false;
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (gesture === null) return;
    // Nothing captured the pointer yet, so a release outside the element
    // never reaches the handlers below. Reading the held buttons is what
    // catches it and keeps a stale gesture from resuming later.
    if (event.buttons === 0) {
      gestureRef.current = null;
      return;
    }
    const travelPx = event.clientX - gesture.startX;
    if (!draggedRef.current && Math.abs(travelPx) < DRAG_SLOP_PX) return;
    if (!draggedRef.current) {
      // Capture only once this is unmistakably a drag. Held from the press
      // instead, it would retarget the `click` of every ordinary press onto
      // this element and swallow the presses meant for the buttons inside.
      draggedRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setSwipe({ offsetPx: travelPx, progress: Math.min(1, Math.abs(travelPx) / gesture.widthPx) });
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setSwipe(null);
    if (gesture === null || !draggedRef.current) return;
    const travelPx = Math.abs(event.clientX - gesture.startX);
    if (travelPx >= gesture.widthPx * DISMISS_TRAVEL_RATIO) onDismiss();
  }, [onDismiss]);

  const onPointerCancel = useCallback(() => {
    gestureRef.current = null;
    setSwipe(null);
  }, []);

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!draggedRef.current) return;
    draggedRef.current = false;
    event.stopPropagation();
  }, []);

  return {
    offsetPx: swipe?.offsetPx ?? 0,
    opacity: 1 - (swipe?.progress ?? 0),
    dragging: swipe !== null,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
