import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { BatchedSubtitleLayerSource } from '@modules/video/mediabunny/caption/BatchedSubtitleLayerSource';

/**
 * Which caption each video frame is painted with.
 *
 * A batch now covers as many timestamps as its pictures stretch to
 * rather than a fixed count, so the source has to read how far each
 * one reached to know where the next begins. Get that wrong and every
 * frame after the first short batch is painted with someone else's
 * caption — a defect no rendering test catches, because each caption
 * on its own is rendered perfectly.
 */

const CAPTION_INTERVAL = 1 / 30;
const TICKS = 200;

/** A frame that remembers the timestamp it was rendered for. */
interface TaggedFrame extends SubtitleFrame {
  readonly renderedFor: number;
}

/**
 * Renderer that answers with a prefix of what it was offered, of a
 * length that keeps changing — the shape of a real batch, whose reach
 * depends on how much the captions move.
 */
class PrefixRenderer implements SubtitleFrameRenderer {
  readonly offeredLengths: number[] = [];
  private nextReach = 0;

  constructor(private readonly reaches: ReadonlyArray<number>) {}

  async open(): Promise<void> {}

  async getMaxTilesPerBatch(): Promise<number> {
    return 4;
  }

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    this.offeredLengths.push(timestamps.length);
    const reach = this.reaches[this.nextReach % this.reaches.length]!;
    this.nextReach++;
    return timestamps.slice(0, Math.min(reach, timestamps.length)).map((t) => this.frameFor(t));
  }

  close(): void {}

  private frameFor(t: number): TaggedFrame {
    return { renderedFor: t, draw: () => {} };
  }
}

const NO_VIDEO_FRAME = null as unknown as DecodedVideoFrame;
const NO_STYLES: Readonly<Record<string, SubtitleStyle>> = {};

async function paintedTimestamps(reaches: ReadonlyArray<number>): Promise<number[]> {
  const renderer = new PrefixRenderer(reaches);
  const source = new BatchedSubtitleLayerSource(renderer);
  await source.open(new Document({ sections: [] }), NO_STYLES, 720, 1280, CAPTION_INTERVAL);
  const painted: number[] = [];
  for (let tick = 0; tick < TICKS; tick++) {
    const [frame] = await source.framesFor([
      { time: tick * CAPTION_INTERVAL, videoFrame: NO_VIDEO_FRAME },
    ]) as Array<TaggedFrame | null>;
    painted.push(frame ? Math.round(frame.renderedFor / CAPTION_INTERVAL) : -1);
  }
  return painted;
}

const EVERY_TICK_IN_ORDER = Array.from({ length: TICKS }, (_, tick) => tick);

describe('a chunk that reaches a different distance every time', () => {
  it('still paints every video frame with its own caption', async () => {
    expect(await paintedTimestamps([1, 7, 3, 41, 13])).toEqual(EVERY_TICK_IN_ORDER);
  });

  it('handles a batch that only ever reaches one tick', async () => {
    expect(await paintedTimestamps([1])).toEqual(EVERY_TICK_IN_ORDER);
  });

  it('handles a batch that reaches everything it was offered', async () => {
    expect(await paintedTimestamps([Number.MAX_SAFE_INTEGER])).toEqual(EVERY_TICK_IN_ORDER);
  });
});

describe('what the source offers', () => {
  it('looks well past the pictures one batch can hold, so a still caption can stretch it', async () => {
    const renderer = new PrefixRenderer([5]);
    const source = new BatchedSubtitleLayerSource(renderer);
    await source.open(new Document({ sections: [] }), NO_STYLES, 720, 1280, CAPTION_INTERVAL);
    await source.framesFor([{ time: 0, videoFrame: NO_VIDEO_FRAME }]);
    expect(renderer.offeredLengths[0]).toBeGreaterThan(await renderer.getMaxTilesPerBatch());
  });
});
