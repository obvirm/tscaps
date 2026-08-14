import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/**
 * Every time on the timeline a dragged edge may stick to: the bounds of
 * each scene and the edges of every word inside them, deduplicated.
 *
 * Built from the scenes the panel is **drawing**, not from the whole
 * document. A landmark the reader cannot see would pull an edge towards
 * a place with nothing at it, and the scenes of another channel are
 * exactly that.
 *
 * Word edges are included whole rather than reduced to the gaps between
 * them, because a cut is as often "from where this word starts" as it is
 * "over this pause".
 */
export class TimelineSnapLandmarks {

  private readonly timesSec: ReadonlyArray<number>;

  constructor(scenes: ReadonlyArray<TimelineSceneExtent>) {
    const times = new Set<number>();
    for (const scene of scenes) {
      times.add(scene.startSec);
      times.add(scene.endSec);
      for (const word of scene.segment.getWords()) {
        times.add(word.time.start);
        times.add(word.time.end);
      }
    }
    this.timesSec = [...times];
  }

  get all(): ReadonlyArray<number> {
    return this.timesSec;
  }
}
