import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The pixel width an element had the first time it was laid out with a
 * real size. Returns a ref callback to attach to the element and that
 * width, or `0` until the first measurement lands.
 *
 * Measuring stops there on purpose. It exists for layouts that must be
 * decided once and then left alone: recomputing the shape on every
 * resize frame reflows the whole content under the user's eyes. Reach
 * for a live measurement only when the content is meant to move.
 *
 * The element is tracked through a ref callback rather than a
 * `RefObject`, so a tree that renders a placeholder first and the
 * measured element later still gets a width.
 */
export function useInitialWidthPx(): [(node: HTMLElement | null) => void, number] {
  const [widthPx, setWidthPx] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      // A hidden panel measures zero, so waiting for a real width is
      // what keeps the one recorded measurement meaningful.
      if (measured <= 0) return;
      observer.disconnect();
      observerRef.current = null;
      setWidthPx(measured);
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return [ref, widthPx];
}
