import type { TimelineSceneExtent } from '@presentation/timeline/services/TimelineSceneExtentResolver';

/**
 * Which tone each scene is drawn in, so no two scenes the eye reads
 * together end up the same colour.
 *
 * Two scenes are read together when they **touch or overlap**, and both
 * halves matter. Touching scenes sit end to end along the bar, which is
 * the case a plain document is made of. Overlapping scenes hand the bar
 * back and forth at the same instant, which is precisely the case the
 * colour exists to explain.
 *
 * Both halves have been got wrong, in opposite directions, back when
 * scenes were drawn on bars of their own: counting positions within a
 * bar left overlapping scenes sharing a tone, and counting globally let
 * one bar skip whichever scenes went to another, so two of its own
 * neighbours landed together.
 *
 * Scenes are taken in start order and each one keeps walking the palette
 * from where the last one left off, so a document with no overlap cycles
 * through the tones exactly as it always did; a scene only steps further
 * when the tone it wanted is already on something it touches.
 *
 * With more scenes running at once than there are tones, some pair has
 * to repeat. The wanted tone is used in that case, so the repeat lands
 * between the two scenes furthest apart in the palette rather than
 * wherever the search happened to stop.
 */
export class TimelineSceneTones {

  private readonly toneBySegmentId = new Map<string, number>();

  constructor(extents: ReadonlyArray<TimelineSceneExtent>, private readonly toneCount: number) {
    this.assign(extents);
  }

  /** Zero-based, always inside the palette's range. */
  of(segmentId: string): number {
    return this.toneBySegmentId.get(segmentId) ?? 0;
  }

  private assign(extents: ReadonlyArray<TimelineSceneExtent>): void {
    const ordered = [...extents].sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);
    const placed: TimelineSceneExtent[] = [];
    let lastTone = -1;
    for (const scene of ordered) {
      const tone = this.toneFor(scene, placed, (lastTone + 1) % this.toneCount);
      this.toneBySegmentId.set(scene.segment.id, tone);
      placed.push(scene);
      lastTone = tone;
    }
  }

  private toneFor(
    scene: TimelineSceneExtent,
    placed: ReadonlyArray<TimelineSceneExtent>,
    wantedTone: number,
  ): number {
    const taken = this.tonesAround(scene, placed);
    for (let step = 0; step < this.toneCount; step++) {
      const tone = (wantedTone + step) % this.toneCount;
      if (!taken.has(tone)) return tone;
    }
    return wantedTone;
  }

  private tonesAround(
    scene: TimelineSceneExtent,
    placed: ReadonlyArray<TimelineSceneExtent>,
  ): Set<number> {
    const tones = new Set<number>();
    for (const other of placed) {
      if (other.endSec < scene.startSec || other.startSec > scene.endSec) continue;
      const tone = this.toneBySegmentId.get(other.segment.id);
      if (tone !== undefined) tones.add(tone);
    }
    return tones;
  }
}
