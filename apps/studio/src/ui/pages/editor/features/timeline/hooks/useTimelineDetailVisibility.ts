import { useEffect, useState } from 'react';
import type {
  TimelineDetailVisibility,
  TimelineVisibilityController,
} from '@presentation/timeline/controllers/TimelineVisibilityController';

/** Reactive read of which of the timeline's details are drawn. */
export function useTimelineDetailVisibility(
  controller: TimelineVisibilityController,
): TimelineDetailVisibility {
  const [visible, setVisible] = useState<TimelineDetailVisibility>(() => controller.visible);
  useEffect(() => {
    const update = () => setVisible(controller.visible);
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return visible;
}
