import { memo, useLayoutEffect, useRef, type MouseEvent } from 'react';
import type { ResizeCorner } from '@presentation/editor/services/ResizeGeometryResolver';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { applyChromeGeometry, measureWordChrome } from '@ui/pages/editor/features/overlay/chromeGeometry';
import { useChromeReposition } from '@ui/pages/editor/features/overlay/hooks/useChromeReposition';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';
import { findWordSpan } from '@ui/pages/editor/features/overlay/wordRotatedBoxProbe';

interface WordResizeHandlesProps {
  wordId: string;
  /** The overlay scaler the chrome is mounted in and measured against. */
  scaler: HTMLElement | null;
}

const CORNERS: readonly ResizeCorner[] = ['tl', 'tr', 'bl', 'br'];

const CORNER_CLASS_BY_KIND: Record<ResizeCorner, string> = {
  tl: 'subtitle-overlay-word-handle-tl',
  tr: 'subtitle-overlay-word-handle-tr',
  bl: 'subtitle-overlay-word-handle-bl',
  br: 'subtitle-overlay-word-handle-br',
};

/**
 * Four corner resize handles for the currently-selected word, mounted
 * at the scaler level so they survive segments rendered empty and
 * stay outside any segment-level SVG filter that would distort them.
 */
export const WordResizeHandles = memo(function WordResizeHandles({ wordId, scaler }: WordResizeHandlesProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const dragState = useOverlayDragState();

  useChromeReposition({
    boxRef: layoutRef,
    scaler,
    targetId: wordId,
    resolveTarget: findWordSpan,
    measure: measureWordChrome,
    apply: applyChromeGeometry,
  });

  if (dragState?.kind === 'segment-rotate') return null;
  return (
    <div ref={layoutRef} className="subtitle-overlay-word-handles" aria-hidden>
      {CORNERS.map((corner) => (
        <CornerHandle key={corner} wordId={wordId} corner={corner} />
      ))}
    </div>
  );
});

interface CornerHandleProps {
  wordId: string;
  corner: ResizeCorner;
}

function CornerHandle({ wordId, corner }: CornerHandleProps) {
  const controller = useOverlayManipulationController();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    return controller.bindWordResizeHandle({ wordId, corner, handle });
  }, [controller, wordId, corner]);
  const className = `subtitle-overlay-word-handle ${CORNER_CLASS_BY_KIND[corner]}`;
  return <div ref={ref} className={className} onClick={swallowClick} aria-hidden />;
}

function swallowClick(event: MouseEvent): void {
  event.stopPropagation();
}
