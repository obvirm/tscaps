import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * How far an element sits from the top of the scrolling element holding
 * it, in the units a scroll offset is expressed in.
 *
 * Null until it can be measured, and callers that place content by
 * scroll offset have to wait for it: treating an unmeasured element as
 * starting at zero puts everything positioned against it too low by
 * whatever is drawn above.
 *
 * Measured once per scroller. Nothing that moves the element inside it
 * afterwards is watched, so an element with changing content above it
 * needs more than this.
 */
export function useOffsetWithinScroller(
  ref: RefObject<HTMLElement | null>,
  scrollEl: HTMLElement | null,
): number | null {
  const [offsetPx, setOffsetPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !scrollEl) return;
    setOffsetPx(
      element.getBoundingClientRect().top
      - scrollEl.getBoundingClientRect().top
      + scrollEl.scrollTop,
    );
  }, [ref, scrollEl]);

  return offsetPx;
}
