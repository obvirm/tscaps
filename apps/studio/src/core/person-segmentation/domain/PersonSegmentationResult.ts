import type { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PassingSample } from '@core/person-segmentation/domain/PassingSample';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';

/**
 * What is known about one video for the text-behind-actor effect.
 *
 * The record is deliberately partial and only ever grows: analysing a
 * stretch of video is expensive, so it is done for the stretches that
 * matter and left undone elsewhere. That makes the distinction between
 * "looked at and rejected" and "never looked at" the load-bearing one
 * — `analyzedRanges` is the only place it lives, and every consumer
 * that could otherwise read silence as an answer has to ask it.
 *
 * The record holds no opinion on how a window is found: it is handed
 * windows already derived, so the rule that decides them is applied in
 * one place rather than re-stated by whoever builds a record.
 */
export class PersonSegmentationResult {

  private constructor(
    /** The stretches of video that have been examined. Everything else is unknown, not invalid. */
    readonly analyzedRanges: TimeRangeSet,
    /** Every examined sample in time order, whether it passed or not. */
    readonly samples: ReadonlyArray<PassingSample>,
    /** Runs of passing samples long enough to count as a scene, never reaching outside {@link analyzedRanges}. */
    readonly windows: ReadonlyArray<PersonSegmentationWindow>,
    /** Actor masks by timestamp. Present for far fewer instants than `analyzedRanges` covers. */
    readonly maskCache: MaskCache,
  ) {}

  /** Nothing examined and nothing captured — the state of a video no one has asked about yet. */
  static nothingKnown(maskCache: MaskCache): PersonSegmentationResult {
    return new PersonSegmentationResult(TimeRangeSet.EMPTY, [], [], maskCache);
  }

  /**
   * A record over samples already sorted by time and windows already
   * derived from them. Both contracts are the caller's to keep; the
   * record trusts what it is handed.
   */
  static of(
    analyzedRanges: TimeRangeSet,
    samples: ReadonlyArray<PassingSample>,
    windows: ReadonlyArray<PersonSegmentationWindow>,
    maskCache: MaskCache,
  ): PersonSegmentationResult {
    return new PersonSegmentationResult(analyzedRanges, samples, windows, maskCache);
  }

  /**
   * Every sample this record and `other` hold, in time order, with
   * `other` winning any instant both examined.
   */
  samplesMergedWith(other: PersonSegmentationResult): ReadonlyArray<PassingSample> {
    const byTime = new Map<number, PassingSample>();
    for (const sample of this.samples) byTime.set(sample.t, sample);
    for (const sample of other.samples) byTime.set(sample.t, sample);
    return [...byTime.values()].sort((a, b) => a.t - b.t);
  }

  /** Everything either record has examined. */
  coverageMergedWith(other: PersonSegmentationResult): TimeRangeSet {
    return TimeRangeSet.of([...this.analyzedRanges.list(), ...other.analyzedRanges.list()]);
  }

  /** Whether every instant of `ranges` has been examined, so silence there is an answer. */
  covers(ranges: TimeRangeSet): boolean {
    return this.missingFrom(ranges).isEmpty();
  }

  /** The parts of `ranges` still unexamined — the work left before `ranges` can be answered for. */
  missingFrom(ranges: TimeRangeSet): TimeRangeSet {
    return ranges.minus(this.analyzedRanges);
  }
}
