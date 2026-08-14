import { createContext, useContext, type ReactNode } from 'react';
import type { ErrorsModule } from '@bootstrap/wiring/errors';

const ErrorsContext = createContext<ErrorsModule | null>(null);

interface ErrorsProviderProps {
  value: ErrorsModule;
  children: ReactNode;
}

export function ErrorsProvider({ value, children }: ErrorsProviderProps) {
  return <ErrorsContext.Provider value={value}>{children}</ErrorsContext.Provider>;
}

/**
 * Returns the errors module. Throws if the consumer is mounted outside
 * `<ErrorsProvider>`; that is always a wiring bug and should surface
 * loudly rather than fall back to a stale or partial surface.
 */
export function useErrors(): ErrorsModule {
  const value = useContext(ErrorsContext);
  if (!value) throw new Error('useErrors must be used inside <ErrorsProvider>');
  return value;
}
