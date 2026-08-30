import { describe, expect, it } from 'vitest';
import type {
  SpriteSheetRasterOutcome,
  SpriteSheetRasterProbe,
  SpriteSheetRasterRefusal,
} from '@modules/rendering/subtitle/SpriteSheetRasterProbe';
import type { SingleTileFallback } from '@modules/rendering/subtitle/SpriteSheetProbeObserver';
import { SpriteSheetSizeProbe } from '@modules/rendering/subtitle/SpriteSheetSizeProbe';

/**
 * How many tiles a sheet ends up holding, and whether anyone is told
 * when that number is one.
 *
 * A capacity of one costs a rasterization per frame and reads exactly
 * like a small host, so the only way to know it happens in the field is
 * for it to announce itself. Both halves are asserted here.
 */

const PORTRAIT_WIDTH = 720;
const PORTRAIT_HEIGHT = 1280;

// Room for far more than the ladder's top entry, so nothing here stops
// on the budget unless a test says so.
const ROOM_FOR_EVERY_LADDER_STEP = 720 * 1280 * 1000;

const HELD: SpriteSheetRasterOutcome = { refusal: null };

/** Holds every sheet up to `holdsUpToTiles`, then refuses with `refusal`. */
class HostHolding implements SpriteSheetRasterProbe {
  readonly askedFor: number[] = [];

  constructor(
    private readonly holdsUpToTiles: number,
    private readonly refusal: SpriteSheetRasterRefusal = 'blank-edge',
    private readonly cause?: unknown,
  ) {}

  async offer(width: number, _height: number): Promise<SpriteSheetRasterOutcome> {
    const tiles = Math.round(width / PORTRAIT_WIDTH);
    this.askedFor.push(tiles);
    if (tiles <= this.holdsUpToTiles) return HELD;
    return { refusal: this.refusal, ...(this.cause !== undefined ? { cause: this.cause } : {}) };
  }
}

/** A probe that breaks the port's promise never to reject. */
class HostThrowing implements SpriteSheetRasterProbe {
  constructor(private readonly thrown: unknown) {}

  async offer(): Promise<SpriteSheetRasterOutcome> {
    throw this.thrown;
  }
}

class RecordingObserver {
  readonly heard: SingleTileFallback[] = [];

  onSingleTileFallback(fallback: SingleTileFallback): void {
    this.heard.push(fallback);
  }
}

function sizeProbeFor(
  rasterProbe: SpriteSheetRasterProbe,
  observer: RecordingObserver,
  maxBufferPixels: number = ROOM_FOR_EVERY_LADDER_STEP,
): SpriteSheetSizeProbe {
  return new SpriteSheetSizeProbe(rasterProbe, observer, maxBufferPixels);
}

describe('the capacity a walk settles on', () => {
  it('takes the largest ladder step the host held', async () => {
    const observer = new RecordingObserver();
    // Holds 8 and 10 is the next step, so the walk stops with 8.
    expect(await sizeProbeFor(new HostHolding(9), observer).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)).toBe(8);
  });

  it('never drops below one, even for a host that holds nothing', async () => {
    const observer = new RecordingObserver();
    expect(await sizeProbeFor(new HostHolding(0), observer).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)).toBe(1);
  });

  it('stops on the pixel budget before asking the host', async () => {
    const observer = new RecordingObserver();
    const host = new HostHolding(Number.MAX_SAFE_INTEGER);
    const roomForFourTiles = PORTRAIT_WIDTH * 4 * PORTRAIT_HEIGHT;
    const sizeProbe = sizeProbeFor(host, observer, roomForFourTiles);
    expect(await sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)).toBe(4);
    expect(host.askedFor).toEqual([1, 2, 4]);
  });
});

describe('who hears about a sheet that holds one tile', () => {
  it('reports a host that would not hold even a single frame', async () => {
    const observer = new RecordingObserver();
    await sizeProbeFor(new HostHolding(0), observer).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    expect(observer.heard).toEqual([{
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      refusedTiles: 1,
      refusal: 'blank-edge',
    }]);
  });

  it('reports a host that held one and refused two, and says which', async () => {
    const observer = new RecordingObserver();
    await sizeProbeFor(new HostHolding(1, 'no-context'), observer).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    expect(observer.heard).toEqual([{
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      refusedTiles: 2,
      refusal: 'no-context',
    }]);
  });

  it('carries whatever was thrown, so the reason can be read later', async () => {
    const observer = new RecordingObserver();
    const cause = new TypeError('decode failed');
    await sizeProbeFor(new HostHolding(0, 'error', cause), observer).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    expect(observer.heard[0]?.cause).toBe(cause);
  });

  it('says nothing when the host held more than one tile', async () => {
    const observer = new RecordingObserver();
    await sizeProbeFor(new HostHolding(4), observer).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    expect(observer.heard).toEqual([]);
  });

  it('says nothing when the budget is what stopped at one, since that is the design', async () => {
    const observer = new RecordingObserver();
    const host = new HostHolding(Number.MAX_SAFE_INTEGER);
    const roomForOneTile = PORTRAIT_WIDTH * PORTRAIT_HEIGHT;
    expect(await sizeProbeFor(host, observer, roomForOneTile).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)).toBe(1);
    expect(observer.heard).toEqual([]);
  });
});

describe('a raster probe that breaks its promise not to reject', () => {
  it('still yields a usable capacity instead of failing the render', async () => {
    const observer = new RecordingObserver();
    const sizeProbe = sizeProbeFor(new HostThrowing(new Error('out of memory')), observer);
    expect(await sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)).toBe(1);
  });

  it('reports it rather than swallowing it, which is what it used to do', async () => {
    const observer = new RecordingObserver();
    const thrown = new Error('out of memory');
    await sizeProbeFor(new HostThrowing(thrown), observer).probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    expect(observer.heard).toEqual([{
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      refusedTiles: 1,
      refusal: 'error',
      cause: thrown,
    }]);
  });
});

describe('asking twice for the same dimensions', () => {
  it('walks once, because two renderers at one size would otherwise each pay', async () => {
    const observer = new RecordingObserver();
    const host = new HostHolding(4);
    const sizeProbe = sizeProbeFor(host, observer);
    await sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    const askedAfterFirst = host.askedFor.length;
    expect(await sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)).toBe(4);
    expect(host.askedFor.length).toBe(askedAfterFirst);
  });

  it('walks once for callers that overlap in flight', async () => {
    const observer = new RecordingObserver();
    const host = new HostHolding(4);
    const sizeProbe = sizeProbeFor(host, observer);
    const [first, second] = await Promise.all([
      sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT),
      sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT),
    ]);
    expect([first, second]).toEqual([4, 4]);
    expect(host.askedFor).toEqual([1, 2, 4, 6]);
  });

  it('reports a collapse once, not once per caller', async () => {
    const observer = new RecordingObserver();
    const sizeProbe = sizeProbeFor(new HostHolding(0), observer);
    await sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    await sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    expect(observer.heard).toHaveLength(1);
  });

  it('walks again for a size it has not seen', async () => {
    const observer = new RecordingObserver();
    const host = new HostHolding(4);
    const sizeProbe = sizeProbeFor(host, observer);
    await sizeProbe.probe(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
    const askedAfterFirst = host.askedFor.length;
    await sizeProbe.probe(PORTRAIT_WIDTH * 2, PORTRAIT_HEIGHT * 2);
    expect(host.askedFor.length).toBeGreaterThan(askedAfterFirst);
  });
});
