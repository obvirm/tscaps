import type { WordTimeLimits } from '@core/captions/services/WordTimeBounds';
import type { TimelineWordDragTarget } from '@presentation/timeline/controllers/gestures/TimelineWordEditGesture';
import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

// Wide open, for a scene the limits do not mention. The gesture's own
// clamping still applies, so an unknown scene is never silently pinned.
const UNBOUNDED: WordTimeLimits = {
  earliestStartSec: Number.NEGATIVE_INFINITY,
  latestEndSec: Number.POSITIVE_INFINITY,
};

/**
 * What a word drag needs to know about the word it grabbed: where its
 * neighbours sit, every scene boundary it can stick to, and how far its
 * own scene is allowed to reach.
 *
 * It is looked up by word id rather than carried on each drawn word,
 * because the neighbours are a property of the scene and a word may be
 * drawn many times over — once per row it crosses.
 */
export class TimelineWordDragTargets {

  private readonly byWordId = new Map<string, TimelineWordDragTarget>();

  constructor(
    scenes: ReadonlyArray<TimelineSceneExtent>,
    private readonly outerLimitsBySegmentId: ReadonlyMap<string, WordTimeLimits> = new Map(),
  ) {
    const sceneBoundariesSec = this.boundariesOf(scenes);
    for (const scene of scenes) this.indexScene(scene, sceneBoundariesSec);
  }

  get(wordId: string): TimelineWordDragTarget | null {
    return this.byWordId.get(wordId) ?? null;
  }

  // Every scene's, not only the grabbed word's own. A word at the edge
  // of its scene has no neighbouring word to stop it, so it can travel
  // as far as the pointer goes, and where it lands is almost always
  // meant to line up with some other scene. Consecutive scenes usually
  // share a boundary, hence the dedupe.
  private boundariesOf(scenes: ReadonlyArray<TimelineSceneExtent>): number[] {
    const boundaries = new Set<number>();
    for (const scene of scenes) {
      boundaries.add(scene.startSec);
      boundaries.add(scene.endSec);
    }
    return [...boundaries];
  }

  private indexScene(scene: TimelineSceneExtent, sceneBoundariesSec: ReadonlyArray<number>): void {
    const words = scene.segment.getWords();
    const wordRanges = words.map((word) => ({ startSec: word.time.start, endSec: word.time.end }));
    const outerLimits = this.outerLimitsBySegmentId.get(scene.segment.id) ?? UNBOUNDED;
    words.forEach((word, wordIndex) => {
      this.byWordId.set(word.id, {
        wordId: word.id,
        text: word.displayText,
        segmentId: scene.segment.id,
        wordIndex,
        wordRanges,
        sceneBoundariesSec,
        outerLimits,
      });
    });
  }
}
