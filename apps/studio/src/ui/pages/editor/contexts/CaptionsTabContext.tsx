import { createContext, useContext, type ReactNode } from 'react';
import type { CaptionsTabStore } from '@presentation/editor/stores/CaptionsTabStore';

const CaptionsTabStoreContext = createContext<CaptionsTabStore | null>(null);

interface CaptionsTabStoreProviderProps {
  value: CaptionsTabStore;
  children: ReactNode;
}

export function CaptionsTabStoreProvider({ value, children }: CaptionsTabStoreProviderProps) {
  return (
    <CaptionsTabStoreContext.Provider value={value}>
      {children}
    </CaptionsTabStoreContext.Provider>
  );
}

/**
 * Returns the Captions-sidebar tab store provided by the closest
 * ancestor. Throws if mounted outside `<CaptionsTabStoreProvider>`;
 * that is always a wiring bug and should surface loudly.
 */
export function useCaptionsTabStore(): CaptionsTabStore {
  const value = useContext(CaptionsTabStoreContext);
  if (!value) throw new Error('useCaptionsTabStore must be used inside <CaptionsTabStoreProvider>');
  return value;
}
