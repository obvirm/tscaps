import { useCallback, useSyncExternalStore } from 'react';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';

/**
 * Reactive read of whether the element inspector is open over the
 * active mode. Re-renders consumers only when that answer changes.
 */
export function useIsElementInspectorOpen(): boolean {
  const store = useEditorWorkspaceStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.isInspectorOpen, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
