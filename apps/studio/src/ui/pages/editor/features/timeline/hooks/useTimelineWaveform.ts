import { useEffect, useState } from 'react';
import { useTimelineWaveformController } from '@ui/pages/editor/features/timeline/contexts/TimelineWaveformContext';
import type { TimelineWaveformState } from '@presentation/timeline/controllers/TimelineWaveformController';

/** Reactive read of the cuts waveform extraction state. */
export function useTimelineWaveformState(): TimelineWaveformState {
  const controller = useTimelineWaveformController();
  const [value, setValue] = useState<TimelineWaveformState>(() => controller.state);
  useEffect(() => {
    const update = () => setValue(controller.state);
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return value;
}
