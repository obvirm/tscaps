import { useLayoutEffect, type RefObject } from 'react';

/**
 * Publishes the element's own width on it, as a multiple of the font
 * size it renders at, under `property`.
 *
 * The multiple is what lets a stylesheet size text against the frame.
 * It is free of the size it was read at, so a rule deriving the font
 * size from it settles: the first read publishes the ratio, the rule
 * resizes the text, and the element comes back with the same ratio.
 * Re-publishing stops there because the value has not changed.
 *
 * Watching the box rather than tracking what could have changed it is
 * deliberate — the width moves with the face, the weight, the spacing,
 * the text and the render state, and a dependency list naming all of
 * them goes stale the first time one is added.
 *
 * This is the preview's own answer to what the engine measures for
 * export against an offline probe. The two paths compute it
 * separately, as they already do for the caption's placement.
 *
 * `enabled` lets a caller skip an element it is conditionally leaving
 * out of the render. It is a dependency rather than an early return, so
 * a component that flips between rendering its element and not is
 * measuring the element actually mounted rather than one React has
 * since replaced.
 */
export function useMeasuredWidth(
  ref: RefObject<HTMLElement | null>,
  property: string,
  enabled: boolean = true,
): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    let published: string | null = null;
    const publish = (): void => {
      const fontSizePx = parseFloat(window.getComputedStyle(element).fontSize) || 0;
      if (fontSizePx <= 0) return;
      const widthEm = String(element.getBoundingClientRect().width / fontSizePx);
      if (widthEm === published) return;
      published = widthEm;
      element.style.setProperty(property, widthEm);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, property, enabled]);
}
