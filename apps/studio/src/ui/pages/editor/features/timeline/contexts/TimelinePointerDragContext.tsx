import { createContext, useContext, type ReactNode } from 'react';
import type { TimelinePointerDragController } from '@presentation/timeline/controllers/TimelinePointerDragController';

const TimelinePointerDragControllerContext = createContext<TimelinePointerDragController | null>(null);

interface TimelinePointerDragControllerProviderProps {
  value: TimelinePointerDragController;
  children: ReactNode;
}

export function TimelinePointerDragControllerProvider({
  value,
  children,
}: TimelinePointerDragControllerProviderProps) {
  return (
    <TimelinePointerDragControllerContext.Provider value={value}>
      {children}
    </TimelinePointerDragControllerContext.Provider>
  );
}

/**
 * Returns the cuts pointer drag controller provided by the closest
 * ancestor. Throws if mounted outside the provider; that is always a
 * wiring bug and should surface loudly.
 */
export function useTimelinePointerDragController(): TimelinePointerDragController {
  const value = useContext(TimelinePointerDragControllerContext);
  if (!value) {
    throw new Error('useTimelinePointerDragController must be used inside <TimelinePointerDragControllerProvider>');
  }
  return value;
}
