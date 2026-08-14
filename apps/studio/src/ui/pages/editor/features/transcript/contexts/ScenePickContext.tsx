import { createContext, useContext, type ReactNode } from 'react';
import type { ScenePickController } from '@presentation/editor/controllers/ScenePickController';

const ScenePickContext = createContext<ScenePickController | null>(null);

interface ScenePickProviderProps {
  value: ScenePickController;
  children: ReactNode;
}

export function ScenePickProvider({ value, children }: ScenePickProviderProps) {
  return (
    <ScenePickContext.Provider value={value}>
      {children}
    </ScenePickContext.Provider>
  );
}

/**
 * Returns the scene pick controller published by the closest ancestor.
 * Throws if mounted outside `<ScenePickProvider>` — always a wiring
 * bug that should surface loudly.
 */
export function useScenePickController(): ScenePickController {
  const value = useContext(ScenePickContext);
  if (!value) throw new Error('useScenePickController must be used inside <ScenePickProvider>');
  return value;
}
