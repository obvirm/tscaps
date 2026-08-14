import type { WordTimeLimits, WordTimeRange } from '@core/captions/services/WordTimeBounds';
import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

const UNBOUNDED: WordTimeLimits = {
  earliestStartSec: Number.NEGATIVE_INFINITY,
  latestEndSec: Number.POSITIVE_INFINITY,
};

/** What dragging a scene's edge needs to know about that scene. */
export interface TimelineSceneDragTarget {
  readonly segmentId: string;
  /**
   * The **window** the scene is drawn for, which is what an edge drag
   * moves. Not the stretch it occupies on the timeline: a window shrunk
   * past its own words still draws them, so the two differ exactly
   * where an edit is most likely.
   */
  readonly window: WordTimeRange;
  /**
   * How far that window may be taken — clear of the hard time of the
   * scenes on its own sheet, and inside the video.
   */
  readonly limits: WordTimeLimits;
}

/**
 * Looked up by segment id rather than carried on each drawn scene run,
 * because a scene is drawn once per row it crosses and every piece
 * would otherwise hold its own copy.
 */
export class TimelineSceneDragTargets {

  private readonly bySegmentId = new Map<string, TimelineSceneDragTarget>();

  constructor(
    scenes: ReadonlyArray<TimelineSceneExtent>,
    limitsBySegmentId: ReadonlyMap<string, WordTimeLimits> = new Map(),
  ) {
    for (const scene of scenes) {
      const time = scene.segment.time;
      this.bySegmentId.set(scene.segment.id, {
        segmentId: scene.segment.id,
        window: { startSec: time.start, endSec: time.end },
        limits: limitsBySegmentId.get(scene.segment.id) ?? UNBOUNDED,
      });
    }
  }

  get(segmentId: string): TimelineSceneDragTarget | null {
    return this.bySegmentId.get(segmentId) ?? null;
  }
}
