import { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import { PersonSegmentationThresholds } from '@core/person-segmentation/domain/PersonSegmentationThresholds';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import type { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PassingSample } from '@core/person-segmentation/domain/PassingSample';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';

/**
 * Builds detector results, holding the rules they all have to be built
 * under: how long a run of passing samples has to last before it counts
 * as a scene, and that no scene may reach into video nobody examined.
 *
 * Every result in the system comes from here so those rules are applied
 * once. A caller that assembled its own would be free to disagree, and
 * two records of the same video disagreeing on where the scenes are is
 * the shape of bug this feature keeps producing.
 */
export class PersonSegmentationResultAssembler {

  constructor(private readonly windowFinder: PassingWindowFinder) {}

  assemble(
    analyzedRanges: TimeRangeSet,
    samples: ReadonlyArray<PassingSample>,
    maskCache: MaskCache,
  ): PersonSegmentationResult {
    const ordered = [...samples].sort((a, b) => a.t - b.t);
    return PersonSegmentationResult.of(
      analyzedRanges,
      ordered,
      this.windowsWithin(analyzedRanges, ordered),
      maskCache,
    );
  }

  /** `base` extended with everything `addition` knows. */
  merged(base: PersonSegmentationResult, addition: PersonSegmentationResult): PersonSegmentationResult {
    return this.assemble(
      base.coverageMergedWith(addition),
      base.samplesMergedWith(addition),
      base.maskCache.mergedWith(addition.maskCache),
    );
  }

  /** The same knowledge about the scenes, carrying a different set of masks. */
  withMasks(result: PersonSegmentationResult, maskCache: MaskCache): PersonSegmentationResult {
    return PersonSegmentationResult.of(result.analyzedRanges, result.samples, result.windows, maskCache);
  }

  /**
   * The scenes the samples describe, cut back to what was actually
   * examined.
   *
   * A run of passing samples is read off the samples alone, and with
   * analysis scoped to the stretches that matter the samples are
   * sparse: the last sample of one stretch and the first of the next
   * are consecutive in the array however much unexamined video lies
   * between them, so an unbounded run would claim a scene nobody
   * looked at. Cutting against the coverage is what keeps the claim
   * honest — and it costs nothing at the seam between two stretches
   * measured back to back, since those merge into one range.
   *
   * The minimum applies again after the cut: a scene sliced down to a
   * fragment is no longer long enough to be one.
   */
  private windowsWithin(
    analyzedRanges: TimeRangeSet,
    orderedSamples: ReadonlyArray<PassingSample>,
  ): ReadonlyArray<PersonSegmentationWindow> {
    const minimumSeconds = PersonSegmentationThresholds.WINDOW_DURATION_MIN_SEC;
    return TimeRangeSet
      .of(this.windowFinder.find(orderedSamples, minimumSeconds))
      .intersectedWith(analyzedRanges)
      .list()
      .filter((window) => window.end - window.start >= minimumSeconds);
  }
}
