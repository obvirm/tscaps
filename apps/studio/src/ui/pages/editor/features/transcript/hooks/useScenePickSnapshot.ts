import { useCallback, useSyncExternalStore } from 'react';
import type { ScenePickSnapshot } from '@presentation/editor/controllers/ScenePickController';
import { useScenePickController } from '@ui/pages/editor/features/transcript/contexts/ScenePickContext';

/**
 * Reactive read of the scene pick state. Consumers re-render whenever
 * pick mode enters/exits, the selection changes, or the hovered
 * boundary moves. Returns the current snapshot object.
 */
export function useScenePickSnapshot(): ScenePickSnapshot {
  const controller = useScenePickController();
  const subscribe = useCallback((cb: () => void) => {
    controller.addEventListener('change', cb);
    return () => controller.removeEventListener('change', cb);
  }, [controller]);
  const getSnapshot = useCallback(() => controller.snapshot(), [controller]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
