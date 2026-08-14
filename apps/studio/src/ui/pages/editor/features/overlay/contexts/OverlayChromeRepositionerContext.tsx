import { createContext, useContext, type ReactNode } from 'react';
import type { OverlayChromeRepositioner } from '@presentation/editor/services/OverlayChromeRepositioner';

const OverlayChromeRepositionerContext = createContext<OverlayChromeRepositioner | null>(null);

interface OverlayChromeRepositionerProviderProps {
  value: OverlayChromeRepositioner;
  children: ReactNode;
}

export function OverlayChromeRepositionerProvider({ value, children }: OverlayChromeRepositionerProviderProps) {
  return (
    <OverlayChromeRepositionerContext.Provider value={value}>
      {children}
    </OverlayChromeRepositionerContext.Provider>
  );
}

/**
 * Returns the repositioner that keeps overlay chrome over what it
 * frames. Throws outside the overlay subtree — always a wiring bug
 * rather than a missing-feature fallback.
 */
export function useOverlayChromeRepositioner(): OverlayChromeRepositioner {
  const value = useContext(OverlayChromeRepositionerContext);
  if (!value) throw new Error('useOverlayChromeRepositioner must be used inside <OverlayChromeRepositionerProvider>');
  return value;
}
