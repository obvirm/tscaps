import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { PreviewSurfaceVariant, SwitchableVideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { PreviewActorMaskOverlayController } from '@presentation/person-segmentation/controllers/PreviewActorMaskOverlayController';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';
import { usePreview } from '@ui/_shared/contexts/modules/PreviewContext';

function useBehindActorSupported(store: EditorStore, checker: BehindActorPreviewSupportChecker): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    store.addEventListener('change', onChange);
    return () => store.removeEventListener('change', onChange);
  }, [store]);
  return useSyncExternalStore(subscribe, useCallback(() => checker.isSupported(), [checker]));
}

function useActiveVariant(surface: SwitchableVideoPreviewSurface): PreviewSurfaceVariant {
  const subscribe = useCallback((onChange: () => void) => {
    surface.addEventListener('variantchange', onChange);
    return () => surface.removeEventListener('variantchange', onChange);
  }, [surface]);
  return useSyncExternalStore(subscribe, useCallback(() => surface.activeVariant, [surface]));
}

/**
 * Mounts the actor-cutout canvas that occludes captions with the
 * segmenter's mask during preview playback. Meant for the subtitle
 * overlay's occlusion slot: the parent element is the caption
 * coordinate space (and the gating DOM root), while the preview
 * canvas to sample is found by walking up to the nearest ancestor
 * that contains one.
 *
 * The mount waits on two signals, and needs both. Support says the
 * session is playing a proxy at all. The active variant says the
 * canvas surface has actually been stood up — a surface that flips
 * mid-session does so from an effect in an ancestor, which React runs
 * *after* this one, so on the support signal alone the canvas to
 * sample would not exist yet and the overlay would sit dead until the
 * next reload.
 *
 * The canvas is `pointer-events: none` and paints above the caption
 * layers so its pixels visually replace whatever text the actor
 * overlaps.
 */
export function PreviewActorMaskOverlay() {
  const personSegmentation = usePersonSegmentation();
  const editor = useEditor();
  const previewSurface = usePreview().surface;
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const overlaySupported = useBehindActorSupported(editor.store, personSegmentation.previewSupportChecker);
  const activeVariant = useActiveVariant(previewSurface);
  const canSamplePreview = overlaySupported && activeVariant === 'canvas';

  useEffect(() => {
    if (!canSamplePreview) return;
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas === null) return;
    const segmentDomRoot = overlayCanvas.parentElement;
    if (segmentDomRoot === null) return;
    const previewCanvas = findPreviewCanvas(overlayCanvas);
    if (previewCanvas === null) return;
    const controller = new PreviewActorMaskOverlayController(
      previewCanvas,
      overlayCanvas,
      segmentDomRoot,
      editor.store,
      personSegmentation.loadedCacheStore,
    );
    controller.start();
    return () => controller.stop();
  }, [canSamplePreview, editor.store, personSegmentation.loadedCacheStore]);

  if (!canSamplePreview) return null;
  return (
    <canvas
      ref={overlayCanvasRef}
      data-actor-mask-overlay
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

/**
 * Walks up from the overlay canvas and returns the preview canvas of
 * the nearest ancestor that contains one, or `null` when no ancestor
 * does. The walk stops at the first hit, so it resolves the video box
 * that hosts this overlay and never a canvas elsewhere on the page.
 */
function findPreviewCanvas(overlayCanvas: HTMLCanvasElement): HTMLCanvasElement | null {
  for (let ancestor = overlayCanvas.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const candidate = ancestor.querySelector('canvas:not([data-actor-mask-overlay])');
    if (candidate instanceof HTMLCanvasElement) return candidate;
  }
  return null;
}
