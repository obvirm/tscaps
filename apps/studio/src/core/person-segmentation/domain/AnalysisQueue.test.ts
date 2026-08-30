import { describe, expect, it } from 'vitest';
import { AnalysisQueue } from '@core/person-segmentation/domain/AnalysisQueue';
import { TimeRangeSet } from '@core/person-segmentation/domain/TimeRangeSet';

/**
 * Deciding which stretch of video to measure next.
 *
 * Whoever is watching decides it, without saying so: the work nearest
 * where they are looking is the work whose absence they are about to
 * notice. That makes a seek a reordering of the whole queue rather
 * than a request to jump anything, and it makes the reach symmetric —
 * someone who lands on a moment can go either way from it.
 *
 * What a chunk is worth is fixed in detector time, not in elapsed
 * video, because that is what the caller is spending. A queue full of
 * holes would otherwise hand out chunks that cost a fraction of a full
 * one while paying the same price to start and to persist.
 */

const CHUNK = 10;

describe('deciding which stretch of video to measure next', () => {
  it('hands out nothing while nothing is waiting', () => {
    expect(new AnalysisQueue().nextChunkNear(0, CHUNK).isEmpty()).toBe(true);
  });

  it('reaches both ways around the viewer', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 100 }]));

    expect(queue.nextChunkNear(50, CHUNK).list()).toEqual([{ start: 45, end: 55 }]);
  });

  it('takes the stretch nearest the viewer, not the earliest', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 4 }, { start: 60, end: 80 }]));

    expect(queue.nextChunkNear(70, CHUNK).list()).toEqual([{ start: 65, end: 75 }]);
  });

  it('starts at the near edge of a stretch the viewer is not inside, and still takes a whole chunk', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 60, end: 80 }]));

    expect(queue.nextChunkNear(20, CHUNK).list()).toEqual([{ start: 60, end: 70 }]);
  });

  it('reaches further to make up for a stretch inside its reach that is already measured', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 100 }]));
    queue.settle(TimeRangeSet.of([{ start: 48, end: 52 }]));

    const chunk = queue.nextChunkNear(50, CHUNK);

    expect(chunk.list()).toEqual([{ start: 43, end: 48 }, { start: 52, end: 57 }]);
    expect(chunk.totalSeconds()).toBe(CHUNK);
  });

  it('is worth a whole chunk however many holes the queue has been left with', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 100 }]));
    queue.settle(TimeRangeSet.of([
      { start: 41, end: 44 }, { start: 46, end: 49 }, { start: 51, end: 54 }, { start: 56, end: 59 },
    ]));

    expect(queue.nextChunkNear(50, CHUNK).totalSeconds()).toBeCloseTo(CHUNK, 10);
  });

  it('hands out everything left when less than a chunk of it remains', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 4 }]));

    expect(queue.nextChunkNear(0, CHUNK).list()).toEqual([{ start: 0, end: 4 }]);
  });

  it('forgets everything waiting when the video underneath it is replaced', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 100 }]));
    queue.clear();

    expect(queue.isEmpty()).toBe(true);
  });

  it('follows the viewer when they move somewhere else', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 100 }]));

    expect(queue.nextChunkNear(10, CHUNK).list()).toEqual([{ start: 5, end: 15 }]);
    expect(queue.nextChunkNear(90, CHUNK).list()).toEqual([{ start: 85, end: 95 }]);
  });

  it('stops asking for a stretch once it has been settled', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 10 }]));
    queue.settle(TimeRangeSet.of([{ start: 0, end: 10 }]));

    expect(queue.isEmpty()).toBe(true);
  });

  it('does not ask twice for a stretch requested twice', () => {
    const queue = new AnalysisQueue();
    queue.request(TimeRangeSet.of([{ start: 0, end: 10 }]));
    queue.request(TimeRangeSet.of([{ start: 5, end: 15 }]));

    expect(queue.remaining().list()).toEqual([{ start: 0, end: 15 }]);
  });
});
