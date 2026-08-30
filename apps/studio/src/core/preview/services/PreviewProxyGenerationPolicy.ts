import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/**
 * Decides whether proxy generation is worth *starting*. How long it is
 * then worth waiting for is measured while it runs, against
 * `PreviewProxyGenerationBudget`.
 *
 * So the only question left is whether a source should be decoded at
 * all: on mobile, not past 1080x1920 worth of pixels (`width * height`,
 * so orientation does not matter). That ceiling guards against taking
 * the tab down, not against a slow encode — and measuring a run
 * requires it to survive its first seconds.
 *
 * Unknown metadata generates: a failed probe is no evidence the source
 * is heavy.
 */
export class PreviewProxyGenerationPolicy {

  private static readonly MOBILE_MAX_PIXELS = 1080 * 1920;

  constructor(private readonly isMobileDevice: boolean) {}

  shouldGenerate(metadata: VideoSourceMetadata): boolean {
    return !this.exceedsPixelBudget(metadata);
  }

  /** Desktop carries no ceiling: it is not where a decode takes the page with it. */
  private exceedsPixelBudget(metadata: VideoSourceMetadata): boolean {
    if (!this.isMobileDevice) return false;
    if (metadata.videoWidthPx === null || metadata.videoHeightPx === null) return false;
    const pixels = metadata.videoWidthPx * metadata.videoHeightPx;
    return pixels > PreviewProxyGenerationPolicy.MOBILE_MAX_PIXELS;
  }
}
