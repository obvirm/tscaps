import { useLayoutEffect, useMemo, type RefObject } from 'react';
import type { ChromeGeometry, OverlayChromeSource } from '@presentation/editor/services/OverlayChromeSource';
import { useOverlayChromeRepositioner } from '@ui/pages/editor/features/overlay/contexts/OverlayChromeRepositionerContext';
import { useOverlayGeometry } from '@ui/pages/editor/features/overlay/contexts/OverlayGeometryContext';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';

export interface ChromeRepositionInput {
  /** The chrome box being laid out. Hidden for as long as the element it frames is not painted. */
  boxRef: RefObject<HTMLElement>;
  /**
   * The overlay scaler: the box chrome is mounted in and measured
   * against, and the root the framed element is searched under. The
   * element rather than a ref to it, so chrome mounted in the same
   * commit measures as soon as the scaler exists — React attaches a
   * parent's ref after its children's layout effects have run.
   */
  scaler: HTMLElement | null;
  /** Id of the element the chrome frames. */
  targetId: string;
  /** The painted element `targetId` names, or null while it is absent from the DOM. Declare it at module level: it is an effect dependency. */
  resolveTarget: (scaler: HTMLElement, targetId: string) => HTMLElement | null;
  /** Reads the geometry the chrome should adopt. Must not write to the DOM. Declare it at module level. */
  measure: (target: HTMLElement, scaler: HTMLElement) => ChromeGeometry;
  /** Writes a geometry `measure` returned. Must not read layout. Declare it at module level. */
  apply: (box: HTMLElement, geometry: ChromeGeometry) => void;
}

/**
 * Keeps one piece of overlay chrome pinned over the element it frames.
 *
 * Chrome is measured from the live DOM rather than laid out by React, so
 * four things put it back where it belongs, and none of them replaces
 * another. The framed element changing and the overlay geometry changing
 * cover a move the element's own box does not show — a rotation, a
 * placement, a reflow above it. A `ResizeObserver` on the framed element
 * itself covers a size change no state of ours predicts, from a font
 * finishing loading to CSS typed into the Code tab. The playhead covers
 * the caption's own animation, which moves an element without changing
 * anything either of the other two can see.
 *
 * Only the playhead runs per frame, and it is the shared batched pass
 * rather than this piece on its own.
 */
export function useChromeReposition({
  boxRef,
  scaler,
  targetId,
  resolveTarget,
  measure,
  apply,
}: ChromeRepositionInput): void {
  const repositioner = useOverlayChromeRepositioner();
  const geometry = useOverlayGeometry();
  const dragState = useOverlayDragState();

  const source = useMemo<OverlayChromeSource>(() => ({
    box: () => boxRef.current,
    scaler: () => scaler,
    target: () => (scaler ? resolveTarget(scaler, targetId) : null),
    measure,
    apply,
  }), [boxRef, scaler, targetId, resolveTarget, measure, apply]);

  useLayoutEffect(() => repositioner.register(source), [repositioner, source]);

  useLayoutEffect(() => {
    repositioner.repositionNow(source);
    if (!scaler) return;
    const reposition = (): void => repositioner.repositionNow(source);
    const observer = new ResizeObserver(reposition);
    observer.observe(scaler);
    // Resolved here rather than reused across geometries: React is free
    // to replace the painted element, and an observer left on the
    // detached node never fires again.
    const target = source.target();
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [repositioner, source, scaler, geometry]);

  useLayoutEffect(() => {
    repositioner.repositionNow(source);
  }, [repositioner, source, dragState]);
}
