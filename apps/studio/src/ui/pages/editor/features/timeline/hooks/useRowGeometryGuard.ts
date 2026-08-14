import { useEffect, useRef, type RefObject } from 'react';

/**
 * Watches a mounted row and complains, during development only, when
 * the browser draws it at a height its geometry never predicted.
 *
 * Deriving the total from the fields the row is styled with stops the
 * two from being different sums, but not from being different sets: a
 * field can be resolved and never applied, or applied twice. The
 * element is the only witness to what was really drawn.
 *
 * Returns the ref to attach to the row's outermost element.
 */
export function useRowGeometryGuard(
  rowIndex: number,
  expectedHeightPx: number,
): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const drawnHeightPx = ref.current?.offsetHeight;
    // Zero means the panel is hidden rather than mismatched: the cuts
    // panel stays mounted between modes and every rect collapses.
    if (drawnHeightPx === undefined || drawnHeightPx === 0) return;
    if (drawnHeightPx === expectedHeightPx) return;
    console.error(
      `[cuts] row ${rowIndex} is drawn ${drawnHeightPx}px tall but its geometry `
      + `reserves ${expectedHeightPx}px. Some part of the row is styled with a value `
      + `the geometry does not include, or includes a value nothing applies.`,
    );
  }, [rowIndex, expectedHeightPx]);

  return ref;
}
