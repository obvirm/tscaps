import { createContext, useContext, type ReactNode } from 'react';
import type { ElementsModule } from '@bootstrap/wiring/elements';

const ElementsContext = createContext<ElementsModule | null>(null);

interface ElementsProviderProps {
  value: ElementsModule;
  children: ReactNode;
}

export function ElementsProvider({ value, children }: ElementsProviderProps) {
  return <ElementsContext.Provider value={value}>{children}</ElementsContext.Provider>;
}

/**
 * Returns the elements module — the CSS one addressed element carries,
 * the entrance it can be given, and the actions that rewrite both.
 * Throws if mounted outside `<ElementsProvider>`; that is always a
 * wiring bug and should surface loudly rather than fall back to a
 * partial surface.
 */
export function useElements(): ElementsModule {
  const value = useContext(ElementsContext);
  if (!value) throw new Error('useElements must be used inside <ElementsProvider>');
  return value;
}
