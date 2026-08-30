import type { PassingSample } from '@core/person-segmentation/domain/PassingSample';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';

/**
 * Groups a chronologically ordered array of pass / fail samples into
 * contiguous time windows of passing samples. Windows shorter than
 * the given minimum duration are dropped — the effect needs a stable
 * scene for at least that long before it makes sense to fire.
 *
 * The grouping reads the samples and nothing else, so it says nothing
 * about the stretches between them: two passing samples with an
 * unexamined hour between them still read as one run. Bounding the
 * answer to what was actually examined is left to the caller.
 */
export class PassingWindowFinder {

  find(samples: ReadonlyArray<PassingSample>, minimumDurationSec: number): ReadonlyArray<PersonSegmentationWindow> {
    const windows: PersonSegmentationWindow[] = [];
    let runStartIndex = -1;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i]!.passes) {
        if (runStartIndex === -1) runStartIndex = i;
        continue;
      }
      if (runStartIndex !== -1) {
        this.emitIfLongEnough(windows, samples[runStartIndex]!.t, samples[i - 1]!.t, minimumDurationSec);
        runStartIndex = -1;
      }
    }
    if (runStartIndex !== -1) {
      this.emitIfLongEnough(windows, samples[runStartIndex]!.t, samples[samples.length - 1]!.t, minimumDurationSec);
    }
    return windows;
  }

  private emitIfLongEnough(
    windows: PersonSegmentationWindow[],
    start: number,
    end: number,
    minimumDurationSec: number,
  ): void {
    if (end - start >= minimumDurationSec) windows.push({ start, end });
  }
}
