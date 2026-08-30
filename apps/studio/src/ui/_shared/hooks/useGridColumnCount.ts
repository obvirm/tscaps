import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * How many columns a CSS grid resolved to, kept in step with its width.
 * Reads the track list the browser computed rather than recomputing it
 * from the element's width, so an `auto-fill` definition stays the only
 * place the breakpoints are written down.
 *
 * Returns `1` until the element is measured, which is the count that
 * makes a caller's row budget hold the fewest items rather than the
 * most.
 */
export function useGridColumnCount(ref: RefObject<HTMLElement | null>): number {
  const [columnCount, setColumnCount] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const tracks = getComputedStyle(element).gridTemplateColumns;
      const resolved = tracks.split(' ').filter((track) => track !== '').length;
      setColumnCount(Math.max(1, resolved));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return columnCount;
}
