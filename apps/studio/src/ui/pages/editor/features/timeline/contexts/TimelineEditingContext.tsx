import { createContext, useContext, type ReactNode } from 'react';
import type { TimelineEditingController } from '@presentation/timeline/controllers/TimelineEditingController';

const TimelineEditingControllerContext = createContext<TimelineEditingController | null>(null);

interface TimelineEditingControllerProviderProps {
  value: TimelineEditingController;
  children: ReactNode;
}

export function TimelineEditingControllerProvider({ value, children }: TimelineEditingControllerProviderProps) {
  return (
    <TimelineEditingControllerContext.Provider value={value}>
      {children}
    </TimelineEditingControllerContext.Provider>
  );
}

/**
 * Returns the cuts editing controller provided by the closest
 * ancestor. Throws if mounted outside the provider; that is always a
 * wiring bug and should surface loudly.
 */
export function useTimelineEditingController(): TimelineEditingController {
  const value = useContext(TimelineEditingControllerContext);
  if (!value) throw new Error('useTimelineEditingController must be used inside <TimelineEditingControllerProvider>');
  return value;
}
