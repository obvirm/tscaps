import type { SpriteSheetRasterRefusal } from '@modules/rendering/subtitle/SpriteSheetRasterProbe';

/** A sizing walk that ended with room for a single tile, and what stopped it. */
export interface SingleTileFallback {
  /** Output dimensions the sheet was being sized for. */
  readonly width: number;
  readonly height: number;
  /**
   * Tiles the sheet held when the host turned it down — only ever 1 or
   * 2. Refusing 2 is a small host; refusing 1 is one that cannot hold a
   * single frame.
   */
  readonly refusedTiles: number;
  readonly refusal: SpriteSheetRasterRefusal;
  /** Whatever was thrown, when `refusal` is `error`. */
  readonly cause?: unknown;
}

/**
 * Told when sizing a sprite sheet ends with room for one tile, which
 * costs a rasterization per frame instead of one per batch.
 *
 * Only a refusal is reported; a capacity the pixel budget decided is
 * the sizing working as designed.
 *
 * Implementations must not throw.
 */
export interface SpriteSheetProbeObserver {
  onSingleTileFallback(fallback: SingleTileFallback): void;
}
