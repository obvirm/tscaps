import { useEffect, useState } from 'react';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

/** Whether the moment on screen is one the detector has not measured yet. */
export function useBehindActorAnalysisBlocked(): boolean {
  const { analysisGateStore } = usePersonSegmentation();
  const [blocked, setBlocked] = useState<boolean>(() => analysisGateStore.blocked);

  useEffect(() => {
    const update = (): void => setBlocked(analysisGateStore.blocked);
    analysisGateStore.addEventListener('change', update);
    update();
    return () => analysisGateStore.removeEventListener('change', update);
  }, [analysisGateStore]);

  return blocked;
}
