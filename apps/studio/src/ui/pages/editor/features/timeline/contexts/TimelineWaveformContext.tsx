import { createContext, useContext, type ReactNode } from 'react';
import type { TimelineWaveformController } from '@presentation/timeline/controllers/TimelineWaveformController';

const TimelineWaveformControllerContext = createContext<TimelineWaveformController | null>(null);

interface TimelineWaveformControllerProviderProps {
  value: TimelineWaveformController;
  children: ReactNode;
}

export function TimelineWaveformControllerProvider({ value, children }: TimelineWaveformControllerProviderProps) {
  return (
    <TimelineWaveformControllerContext.Provider value={value}>
      {children}
    </TimelineWaveformControllerContext.Provider>
  );
}

/**
 * Returns the cuts waveform controller provided by the closest
 * ancestor. Throws if mounted outside the provider; that is always a
 * wiring bug and should surface loudly.
 */
export function useTimelineWaveformController(): TimelineWaveformController {
  const value = useContext(TimelineWaveformControllerContext);
  if (!value) throw new Error('useTimelineWaveformController must be used inside <TimelineWaveformControllerProvider>');
  return value;
}
