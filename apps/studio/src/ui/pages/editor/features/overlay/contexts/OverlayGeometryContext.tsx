import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';

/**
 * Everything that decides where a caption lands in the scaler and how
 * big it is. Its identity is the signal — a new one means anything in
 * the overlay may have moved or resized — and the members are there so
 * the value says what geometry it stands for.
 */
export interface OverlayGeometry {
  readonly document: Document;
  readonly sheets: ReadonlyArray<Sheet>;
  readonly elementStyles: ElementStyles;
  readonly behindActorActiveSegmentIds: ReadonlySet<string>;
}

const OverlayGeometryContext = createContext<OverlayGeometry | null>(null);

interface OverlayGeometryProviderProps extends OverlayGeometry {
  children: ReactNode;
}

/**
 * Publishes a new `OverlayGeometry` whenever one of its parts changes.
 *
 * One signal rather than each piece of chrome naming the inputs it
 * cares about. Chrome is measured from the live DOM, never laid out by
 * React, so an input nobody listed is chrome frozen over a box that
 * moved, with nothing on screen to say so.
 */
export function OverlayGeometryProvider({
  document: doc,
  sheets,
  elementStyles,
  behindActorActiveSegmentIds,
  children,
}: OverlayGeometryProviderProps) {
  const geometry = useMemo<OverlayGeometry>(
    () => ({ document: doc, sheets, elementStyles, behindActorActiveSegmentIds }),
    [doc, sheets, elementStyles, behindActorActiveSegmentIds],
  );
  return <OverlayGeometryContext.Provider value={geometry}>{children}</OverlayGeometryContext.Provider>;
}

/**
 * Returns the geometry the overlay is currently painting, for use as an
 * effect dependency. Throws outside the overlay subtree — always a
 * wiring bug rather than a missing-feature fallback.
 */
export function useOverlayGeometry(): OverlayGeometry {
  const value = useContext(OverlayGeometryContext);
  if (!value) throw new Error('useOverlayGeometry must be used inside <OverlayGeometryProvider>');
  return value;
}
