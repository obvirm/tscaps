import type {
  SpriteSheetRasterOutcome,
  SpriteSheetRasterProbe,
} from '@modules/rendering/subtitle/SpriteSheetRasterProbe';

const MARKER_SIZE_PX = 2;

/**
 * Draws a data-URL SVG through an `<img>` onto a canvas, the same
 * delivery path a real sprite sheet takes, and reads its far corner
 * back.
 *
 * The readback is the point: some hosts decode an oversize SVG and
 * report success while leaving the far edges unpainted. Nothing public
 * answers this instead — the reported WebGL limits (`MAX_TEXTURE_SIZE`,
 * `MAX_VIEWPORT_DIMS`) bear no stable relation to what `img.decode` and
 * `drawImage` accept.
 */
export class ImageDecodeSpriteSheetRasterProbe implements SpriteSheetRasterProbe {

  async offer(width: number, height: number): Promise<SpriteSheetRasterOutcome> {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(this.markerSvg(width, height))}`;
    try {
      await image.decode();
      const context = new OffscreenCanvas(width, height).getContext('2d');
      if (!context) return { refusal: 'no-context' };
      context.drawImage(image, 0, 0);
      const corner = context.getImageData(width - 1, height - 1, 1, 1).data;
      return this.isMarker(corner) ? { refusal: null } : { refusal: 'blank-edge' };
    } catch (cause) {
      return { refusal: 'error', cause };
    }
  }

  private markerSvg(width: number, height: number): string {
    const x = width - MARKER_SIZE_PX;
    const y = height - MARKER_SIZE_PX;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
      + `<rect width="100%" height="100%" fill="green"/>`
      + `<rect x="${x}" y="${y}" width="${MARKER_SIZE_PX}" height="${MARKER_SIZE_PX}" fill="red"/>`
      + `</svg>`;
  }

  private isMarker(pixel: Uint8ClampedArray): boolean {
    return pixel[0]! > 200 && pixel[1]! < 80 && pixel[2]! < 80 && pixel[3]! > 200;
  }
}
