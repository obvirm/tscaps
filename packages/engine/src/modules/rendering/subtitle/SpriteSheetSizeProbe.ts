import type { SpriteSheetProbeObserver } from '@modules/rendering/subtitle/SpriteSheetProbeObserver';
import type {
  SpriteSheetRasterProbe,
  SpriteSheetRasterRefusal,
} from '@modules/rendering/subtitle/SpriteSheetRasterProbe';

const NUMBER_OF_TILES_TO_TEST = [1, 2, 4, 6, 8, 10, 12, 15, 18, 21, 25, 30];

// 10 frames at 1080×1920 ≈ 80 MB of pixel buffer.
// At 4K the same budget admits only ~2 tiles per batch.
const DEFAULT_MAX_BUFFER_PIXELS = 10 * 1080 * 1920;

interface SheetSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Finds how many subtitle tiles fit into one sprite sheet at given
 * output dimensions, by offering a host a ladder of sizes until it
 * refuses or the pixel budget runs out.
 *
 * Answers are memoized per dimension pair for the life of the instance.
 * A walk decodes rasters up to the whole budget, so renderers working
 * at the same size should share one instance.
 *
 * A capacity of one that came from a refusal reaches `observer`.
 */
export class SpriteSheetSizeProbe {

  private readonly byDimensions = new Map<string, Promise<number>>();

  constructor(
    private readonly rasterProbe: SpriteSheetRasterProbe,
    private readonly observer: SpriteSheetProbeObserver | null = null,
    private readonly maxBufferPixels: number = DEFAULT_MAX_BUFFER_PIXELS,
  ) {}

  /**
   * Tiles per sheet at these dimensions, never below one and never
   * rejecting. Calls for the same dimensions share one walk, including
   * calls that overlap in flight.
   */
  probe(width: number, height: number): Promise<number> {
    const key = `${width}x${height}`;
    let pending = this.byDimensions.get(key);
    if (!pending) {
      pending = this.measure(width, height);
      this.byDimensions.set(key, pending);
    }
    return pending;
  }

  private async measure(width: number, height: number): Promise<number> {
    try {
      let held = 1;
      for (const tiles of NUMBER_OF_TILES_TO_TEST) {
        const sheet = this.sheetFor(width, height, tiles);
        if (sheet.width * sheet.height > this.maxBufferPixels) return held;
        const outcome = await this.rasterProbe.offer(sheet.width, sheet.height);
        if (outcome.refusal === null) {
          held = tiles;
          continue;
        }
        if (held === 1) this.reportFallback(width, height, tiles, outcome.refusal, outcome.cause);
        return held;
      }
      return held;
    } catch (cause) {
      // The raster probe promises not to reject, so something under it
      // broke that promise. Still owes a usable number.
      this.reportFallback(width, height, 1, 'error', cause);
      return 1;
    }
  }

  /** Tiles stack along the smaller axis, so a sheet grows in one dimension only. */
  private sheetFor(width: number, height: number, tiles: number): SheetSize {
    return width < height
      ? { width: width * tiles, height }
      : { width, height: height * tiles };
  }

  private reportFallback(
    width: number,
    height: number,
    refusedTiles: number,
    refusal: SpriteSheetRasterRefusal,
    cause: unknown,
  ): void {
    if (!this.observer) return;
    try {
      this.observer.onSingleTileFallback({
        width,
        height,
        refusedTiles,
        refusal,
        ...(cause !== undefined ? { cause } : {}),
      });
    } catch {
      // Reporting is best-effort by contract; a broken channel must not
      // take the render with it.
    }
  }
}
