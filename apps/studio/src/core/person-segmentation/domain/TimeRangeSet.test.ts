import { describe, expect, it } from 'vitest';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';

/**
 * Naming the stretches of a video worth looking at.
 *
 * The ranges come in one per caption, in whatever order the document
 * holds them, often touching or overlapping each other. Everything
 * downstream walks them in time order and assumes each instant is
 * visited once, so the set has to earn that assumption before anyone
 * seeks a frame.
 */

describe('naming the stretches of a video worth looking at', () => {
  it('puts the ranges in time order whatever order they arrive in', () => {
    const set = TimeRangeSet.of([{ start: 8, end: 9 }, { start: 1, end: 2 }, { start: 4, end: 5 }]);

    expect(set.list()).toEqual([{ start: 1, end: 2 }, { start: 4, end: 5 }, { start: 8, end: 9 }]);
  });

  it('fuses ranges that overlap into the stretch they cover together', () => {
    const set = TimeRangeSet.of([{ start: 0, end: 5 }, { start: 3, end: 8 }]);

    expect(set.list()).toEqual([{ start: 0, end: 8 }]);
  });

  it('fuses ranges that merely touch, so no walk visits the seam twice', () => {
    const set = TimeRangeSet.of([{ start: 0, end: 2 }, { start: 2, end: 4 }]);

    expect(set.list()).toEqual([{ start: 0, end: 4 }]);
  });

  it('keeps a range wholly inside another from reopening it', () => {
    const set = TimeRangeSet.of([{ start: 0, end: 10 }, { start: 3, end: 4 }]);

    expect(set.list()).toEqual([{ start: 0, end: 10 }]);
  });

  it('drops ranges that hold no time at all', () => {
    const set = TimeRangeSet.of([{ start: 2, end: 2 }, { start: 5, end: 4 }]);

    expect(set.isEmpty()).toBe(true);
  });

  it('grows both sides when padded, and never reaches before the video starts', () => {
    const set = TimeRangeSet.of([{ start: 0.5, end: 2 }]).paddedBy(1);

    expect(set.list()).toEqual([{ start: 0, end: 3 }]);
  });

  it('fuses neighbours that padding pushed into each other', () => {
    const set = TimeRangeSet.of([{ start: 0, end: 2 }, { start: 3, end: 5 }]).paddedBy(1);

    expect(set.list()).toEqual([{ start: 0, end: 6 }]);
  });

  it('keeps only what two sets both hold', () => {
    const scenes = TimeRangeSet.of([{ start: 0, end: 10 }, { start: 20, end: 30 }]);
    const captions = TimeRangeSet.of([{ start: 5, end: 25 }]);

    expect(scenes.intersectedWith(captions).list()).toEqual([{ start: 5, end: 10 }, { start: 20, end: 25 }]);
  });

  it('holds nothing in common with a set it never meets', () => {
    const scenes = TimeRangeSet.of([{ start: 0, end: 4 }]);
    const captions = TimeRangeSet.of([{ start: 9, end: 12 }]);

    expect(scenes.intersectedWith(captions).isEmpty()).toBe(true);
  });

  it('cuts a range short at the end of the video and drops what starts past it', () => {
    const set = TimeRangeSet.of([{ start: 1, end: 9 }, { start: 40, end: 44 }]).clampedTo(6);

    expect(set.list()).toEqual([{ start: 1, end: 6 }]);
  });

  it('leaves the two pieces around a stretch taken out of its middle', () => {
    const wanted = TimeRangeSet.of([{ start: 0, end: 10 }]);
    const alreadyDone = TimeRangeSet.of([{ start: 4, end: 6 }]);

    expect(wanted.minus(alreadyDone).list()).toEqual([{ start: 0, end: 4 }, { start: 6, end: 10 }]);
  });

  it('holds nothing back when the other set covers it whole', () => {
    const wanted = TimeRangeSet.of([{ start: 2, end: 4 }]);
    const alreadyDone = TimeRangeSet.of([{ start: 0, end: 10 }]);

    expect(wanted.minus(alreadyDone).isEmpty()).toBe(true);
  });

  it('keeps only the ends when the other set covers the middle of each range', () => {
    const wanted = TimeRangeSet.of([{ start: 0, end: 4 }, { start: 10, end: 14 }]);
    const alreadyDone = TimeRangeSet.of([{ start: 1, end: 3 }, { start: 11, end: 13 }]);

    expect(wanted.minus(alreadyDone).list()).toEqual([
      { start: 0, end: 1 }, { start: 3, end: 4 }, { start: 10, end: 11 }, { start: 13, end: 14 },
    ]);
  });

  it('is unchanged by subtracting a set it never meets', () => {
    const wanted = TimeRangeSet.of([{ start: 0, end: 4 }]);

    expect(wanted.minus(TimeRangeSet.of([{ start: 9, end: 12 }])).list()).toEqual([{ start: 0, end: 4 }]);
  });

  it('adds up the time it holds, counting a fused overlap once', () => {
    const set = TimeRangeSet.of([{ start: 0, end: 5 }, { start: 3, end: 8 }]);

    expect(set.totalSeconds()).toBe(8);
  });
});
