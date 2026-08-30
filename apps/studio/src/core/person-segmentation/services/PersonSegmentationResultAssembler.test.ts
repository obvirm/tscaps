import { describe, expect, it } from 'vitest';
import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PassingSample } from '@core/person-segmentation/domain/PassingSample';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';
import { PassingWindowFinder } from '@core/person-segmentation/services/PassingWindowFinder';
import { PersonSegmentationResultAssembler } from '@core/person-segmentation/services/PersonSegmentationResultAssembler';

/**
 * Deciding which scenes a video has, from the frames that were looked
 * at.
 *
 * A scene is a run of frames that all passed, and the frames are
 * sparse on purpose: only the stretches a caption sits on are ever
 * examined. So two frames next to each other in the record can be
 * minutes apart in the video, and reading them as one unbroken run
 * would claim a scene over footage nobody watched. What was examined
 * is the boundary, and the record may not reach past it.
 *
 * The same rule has to leave a scene alone when it genuinely runs
 * across two stretches measured one after the other — that seam is an
 * artefact of how the work was scheduled, not something in the video.
 */

const assembler = new PersonSegmentationResultAssembler(new PassingWindowFinder());

function passingEverySecond(from: number, to: number): PassingSample[] {
  const samples: PassingSample[] = [];
  for (let t = from; t <= to; t++) samples.push({ t, passes: true });
  return samples;
}

describe('deciding which scenes a video has, from the frames that were looked at', () => {
  it('does not stretch a scene across footage nobody examined', () => {
    const result = assembler.assemble(
      TimeRangeSet.of([{ start: 0, end: 5 }, { start: 20, end: 25 }]),
      [...passingEverySecond(0, 5), ...passingEverySecond(20, 25)],
      new MaskCache(),
    );

    expect(result.windows).toEqual([{ start: 0, end: 5 }, { start: 20, end: 25 }]);
  });

  it('keeps a scene whole across the seam between two stretches measured back to back', () => {
    const result = assembler.assemble(
      TimeRangeSet.of([{ start: 0, end: 5 }, { start: 5, end: 10 }]),
      passingEverySecond(0, 10),
      new MaskCache(),
    );

    expect(result.windows).toEqual([{ start: 0, end: 10 }]);
  });

  it('drops what is left of a scene when the cut leaves too little of it to be one', () => {
    const result = assembler.assemble(
      TimeRangeSet.of([{ start: 0, end: 10 }, { start: 30, end: 30.5 }]),
      [...passingEverySecond(0, 10), { t: 30, passes: true }, { t: 30.5, passes: true }],
      new MaskCache(),
    );

    expect(result.windows).toEqual([{ start: 0, end: 10 }]);
  });

  it('reports nothing examined as no scenes at all', () => {
    const result = assembler.assemble(TimeRangeSet.EMPTY, [], new MaskCache());

    expect(result.windows).toEqual([]);
  });

  it('re-reads the scenes from both records when two are merged, rather than from either alone', () => {
    const firstHalf = assembler.assemble(
      TimeRangeSet.of([{ start: 0, end: 5 }]),
      passingEverySecond(0, 5),
      new MaskCache(),
    );
    const secondHalf = assembler.assemble(
      TimeRangeSet.of([{ start: 5, end: 10 }]),
      passingEverySecond(5, 10),
      new MaskCache(),
    );

    expect(assembler.merged(firstHalf, secondHalf).windows).toEqual([{ start: 0, end: 10 }]);
  });
});
