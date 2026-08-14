import { createContext, useContext, type ReactNode } from 'react';
import type { ElementAlignmentResolver } from '@presentation/editor/services/ElementAlignmentResolver';

const ElementAlignmentContext = createContext<ElementAlignmentResolver | null>(null);

interface ElementAlignmentProviderProps {
  value: ElementAlignmentResolver;
  children: ReactNode;
}

export function ElementAlignmentProvider({ value, children }: ElementAlignmentProviderProps) {
  return <ElementAlignmentContext.Provider value={value}>{children}</ElementAlignmentContext.Provider>;
}

export function useElementAlignmentResolver(): ElementAlignmentResolver {
  const value = useContext(ElementAlignmentContext);
  if (!value) throw new Error('useElementAlignmentResolver must be used inside <ElementAlignmentProvider>');
  return value;
}
