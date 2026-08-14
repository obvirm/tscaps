import { useRef } from 'react';
import { applyChromeGeometry, measureWordChrome } from '@ui/pages/editor/features/overlay/chromeGeometry';
import { useChromeReposition } from '@ui/pages/editor/features/overlay/hooks/useChromeReposition';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';
import { findWordSpan } from '@ui/pages/editor/features/overlay/wordRotatedBoxProbe';

interface WordSelectionRingProps {
  wordId: string;
  /** The overlay scaler the chrome is mounted in and measured against. */
  scaler: HTMLElement | null;
}

/**
 * Selection ring for the active word, drawn as an absolutely-positioned
 * box over the word but OUTSIDE the filtered `.segment`. A template's
 * segment-level SVG filter (outline/glow) flattens its whole subtree, so a
 * selection outline placed on the word itself gets captured and distorted
 * by the filter; drawing it as a sibling of the filtered segment keeps it
 * crisp.
 */
export function WordSelectionRing({ wordId, scaler }: WordSelectionRingProps) {
  const ringRef = useRef<HTMLDivElement>(null);
  const dragState = useOverlayDragState();

  useChromeReposition({
    boxRef: ringRef,
    scaler,
    targetId: wordId,
    resolveTarget: findWordSpan,
    measure: measureWordChrome,
    apply: applyChromeGeometry,
  });

  if (dragState?.kind === 'segment-rotate') return null;
  return <div ref={ringRef} className="subtitle-overlay-word-selection" aria-hidden />;
}
