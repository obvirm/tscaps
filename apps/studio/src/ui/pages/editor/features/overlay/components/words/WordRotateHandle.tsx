import { memo, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { RotateCw } from 'lucide-react';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { applyChromeGeometry, measureWordChrome } from '@ui/pages/editor/features/overlay/chromeGeometry';
import { useChromeReposition } from '@ui/pages/editor/features/overlay/hooks/useChromeReposition';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';
import { findWordSpan } from '@ui/pages/editor/features/overlay/wordRotatedBoxProbe';

interface WordRotateHandleProps {
  wordId: string;
  /** The overlay scaler the chrome is mounted in and measured against. */
  scaler: HTMLElement | null;
}

/**
 * Rotation icon mounted above the selected word. Rendered inside a
 * rotated frame so the handle stays at the top-center of the WORD's
 * rotated visual frame, not at the top-center of its axis-aligned
 * bounding rect.
 *
 * Mounted at the scaler level so it survives segments rendered empty
 * and stays outside any segment-level SVG filter that would distort it.
 */
export const WordRotateHandle = memo(function WordRotateHandle({ wordId, scaler }: WordRotateHandleProps) {
  const controller = useOverlayManipulationController();
  const dragState = useOverlayDragState();
  const frameRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useChromeReposition({
    boxRef: frameRef,
    scaler,
    targetId: wordId,
    resolveTarget: findWordSpan,
    measure: measureWordChrome,
    apply: applyChromeGeometry,
  });

  useLayoutEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    return controller.bindWordRotateHandle({ wordId, handle });
  }, [controller, wordId]);

  if (dragState?.kind === 'segment-rotate') return null;
  const rotationLabel = dragState?.kind === 'word-rotate' && dragState.wordId === wordId
    ? `${Math.round(dragState.rotationDeg)}°`
    : null;
  const className = rotationLabel !== null
    ? 'subtitle-overlay-word-rotate-handle is-rotating'
    : 'subtitle-overlay-word-rotate-handle';
  return (
    <div ref={frameRef} className="subtitle-overlay-word-rotate-frame" aria-hidden>
      <div ref={handleRef} className={className} onClick={swallowClick}>
        {rotationLabel ?? <RotateCw size={12} />}
      </div>
    </div>
  );
});

function swallowClick(event: MouseEvent): void {
  event.stopPropagation();
}
