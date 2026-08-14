import type { LocalStorageClient } from '@core/_shared/infrastructure/LocalStorageClient';
import type { TimelineDetailChoicesRepository } from '@core/timeline/domain/TimelineDetailChoicesRepository';
import {
  TIMELINE_DETAILS,
  type TimelineDetail,
  type TimelineDetailChoices,
} from '@core/timeline/domain/TimelineDetail';

const KEY = 'timeline-detail-choices';

/**
 * localStorage-backed implementation. Reads keep only the details this
 * build publishes and only where the stored answer is a boolean, so an
 * id we no longer ship — or a corrupted entry — falls back to its
 * default rather than deciding something nobody can name.
 */
export class LocalStorageTimelineDetailChoicesRepository implements TimelineDetailChoicesRepository {

  constructor(private readonly storage: LocalStorageClient) {}

  load(): TimelineDetailChoices {
    const stored = this.storage.get<unknown>(KEY);
    if (stored === null || typeof stored !== 'object') return {};
    const choices: Partial<Record<TimelineDetail, boolean>> = {};
    for (const detail of TIMELINE_DETAILS) {
      const chosen = (stored as Record<string, unknown>)[detail];
      if (typeof chosen === 'boolean') choices[detail] = chosen;
    }
    return choices;
  }

  save(choices: TimelineDetailChoices): void {
    this.storage.set(KEY, choices);
  }
}
