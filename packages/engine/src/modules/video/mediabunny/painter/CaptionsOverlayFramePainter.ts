import type { Document } from '@modules/document/Document';
import type { OverlayFrame, OverlayFrameRenderer } from '@modules/rendering/OverlayFrameRenderer';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { FrameCompositor } from '@modules/video/mediabunny/frame/FrameCompositor';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import type { PaintFrame } from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import type { FramePainter, FramePaintRequest } from '@modules/video/mediabunny/painter/FramePainter';

/**
 * Caption ticks step at the source's frame rate up to this cap. Past
 * it, per-letter or per-word animations gain nothing from extra renders
 * (the eye doesn't resolve sub-30fps differences in caption motion) and
 * the per-batch subtitle decode dominates the render budget.
 */
const CAPTION_FPS_CAP = 30;

/**
 * Paints each output frame as the source frame composited with a
 * per-timestamp caption raster and a frame-invariant overlay. The
 * caption strategy (batched, video-frame-bound, mixed) lives entirely
 * behind the {@link SubtitleLayerSource} injected in the constructor.
 *
 * Single-use: one open/close cycle per instance. Build a fresh one for
 * each transcode run through the factory.
 */
export class CaptionsOverlayFramePainter implements FramePainter {

  private width = 0;
  private height = 0;
  private overlay: OverlayFrame | null = null;

  constructor(
    private readonly subtitleLayer: SubtitleLayerSource,
    private readonly overlayRenderer: OverlayFrameRenderer,
    private readonly frameCompositor: FrameCompositor,
    private readonly document: Document,
    private readonly styles: Readonly<Record<string, SubtitleStyle>>,
    private readonly overlayHtml: string | undefined,
    private readonly topLayer: TopLayerSource | null,
  ) {}

  async begin(width: number, height: number, fps: number): Promise<void> {
    this.width = width;
    this.height = height;
    const captionInterval = 1 / Math.min(fps, CAPTION_FPS_CAP);
    await this.subtitleLayer.open(this.document, this.styles, width, height, captionInterval);
    if (this.overlayHtml !== undefined) {
      this.overlay = await this.overlayRenderer.render(this.overlayHtml, width, height);
    }
    if (this.topLayer !== null) {
      await this.topLayer.open(width, height);
    }
  }

  lookAhead(): number {
    return this.subtitleLayer.lookAhead();
  }

  async paint(requests: ReadonlyArray<FramePaintRequest>): Promise<PaintFrame[]> {
    const captions = await this.subtitleLayer.framesFor(
      requests.map(({ frame }) => ({ time: frame.timestamp, videoFrame: frame })),
    );
    const topLayers = await this.paintTopLayers(requests);
    return requests.map(({ frame }, i) => (ctx) => {
      this.frameCompositor.compose(ctx, {
        frame,
        captions: captions[i] ?? null,
        overlay: this.overlay,
        topLayer: topLayers[i] ?? null,
        width: this.width,
        height: this.height,
      });
    });
  }

  /**
   * One per request, or all null when no top layer is configured. Kept
   * frame by frame because the top layer reads the frame it occludes
   * and has no batch of its own to amortize.
   */
  private async paintTopLayers(
    requests: ReadonlyArray<FramePaintRequest>,
  ): Promise<Array<OverlayFrame | null>> {
    if (this.topLayer === null) return requests.map(() => null);
    const layers: Array<OverlayFrame | null> = [];
    for (const { frame } of requests) {
      layers.push(await this.topLayer.frameAt(frame.timestamp, frame));
    }
    return layers;
  }

  end(): void {
    this.subtitleLayer.close();
    this.topLayer?.close();
    this.overlay = null;
  }
}
