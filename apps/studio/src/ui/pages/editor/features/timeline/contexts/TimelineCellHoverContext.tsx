import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { TimelineCellHoverController } from '@presentation/timeline/controllers/TimelineCellHoverController';

const TimelineCellHoverControllerContext = createContext<TimelineCellHoverController | null>(null);

interface TimelineCellHoverControllerProviderProps {
  value: TimelineCellHoverController;
  children: ReactNode;
}

export function TimelineCellHoverControllerProvider({
  value,
  children,
}: TimelineCellHoverControllerProviderProps) {
  return (
    <TimelineCellHoverControllerContext.Provider value={value}>
      {children}
    </TimelineCellHoverControllerContext.Provider>
  );
}

/**
 * Returns the cell hover controller provided by the closest ancestor.
 * Throws if mounted outside the provider; that is always a wiring bug
 * and should surface loudly.
 */
export function useTimelineCellHoverController(): TimelineCellHoverController {
  const value = useContext(TimelineCellHoverControllerContext);
  if (!value) throw new Error('useTimelineCellHoverController must be used inside <TimelineCellHoverControllerProvider>');
  return value;
}

/**
 * Whether the pointer is over some piece of the given cell.
 *
 * `enabled` is what keeps this cheap: only a cell drawn in more than
 * one piece has anything to gain, so whole cells pass `false` and never
 * subscribe at all. Hovering is a stream of events and a timeline holds
 * hundreds of chips.
 */
export function useTimelineCellHovered(cellId: string, enabled: boolean): boolean {
  const controller = useTimelineCellHoverController();
  return useSyncExternalStore(
    useCallback((onChange: () => void) => {
      if (!enabled) return () => {};
      controller.addEventListener('change', onChange);
      return () => controller.removeEventListener('change', onChange);
    }, [controller, enabled]),
    () => enabled && controller.hoveredCellId === cellId,
  );
}
