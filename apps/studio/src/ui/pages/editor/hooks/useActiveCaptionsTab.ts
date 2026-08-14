import { useCallback, useSyncExternalStore } from 'react';
import type { CaptionsTabId } from '@presentation/editor/stores/CaptionsTabStore';
import { useCaptionsTabStore } from '@ui/pages/editor/contexts/CaptionsTabContext';

/**
 * Reactive read of the active Captions-sidebar tab. Re-renders
 * consumers only when the active tab id itself changes.
 */
export function useActiveCaptionsTab(): CaptionsTabId {
  const store = useCaptionsTabStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.activeTabId, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
