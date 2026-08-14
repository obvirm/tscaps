import { useCallback } from 'react';
import { useRangeReplay } from '@ui/pages/editor/features/element/useRangeReplay';

// A scene is painted over a half-open window, so its own end is the
// first instant it is gone — and every surface narrowed to the scene
// being painted goes with it. A sixtieth is the shortest frame the
// editor assumes anywhere, so stopping that far short lands inside the
// scene at any frame rate.
const LAST_PAINTED_FRAME_SEC = 1 / 60;

/**
 * Plays a stretch of the video once, silently, without ever leaving
 * the scene it belongs to however far it is asked to reach.
 *
 * Pass the end of the scene the stretch lives in. A replay allowed past
 * it comes to rest on a frame the scene no longer paints, which empties
 * whatever surface asked for the replay in the first place.
 */
export function useSceneReplay(sceneEndsAt: number): (startSec: number, endSec: number) => void {
  const replayRange = useRangeReplay();
  return useCallback(
    (startSec: number, endSec: number) =>
      replayRange(startSec, Math.min(endSec, sceneEndsAt - LAST_PAINTED_FRAME_SEC)),
    [replayRange, sceneEndsAt],
  );
}
