import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type {
  PreviewProxyGenerator,
  PreviewProxyProgressCallback,
} from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';

/**
 * Outcome of a source-based proxy resolution.
 *
 * - `previewBlob` is what the preview surface must load: the freshly
 *   generated proxy, or the source itself when the pipeline is
 *   disabled.
 * - `freshProxy` is the proxy that was just generated from `source`
 *   and still needs to be persisted, or `null` when nothing new was
 *   produced (disabled pipeline).
 */
export interface PreviewProxyResolution {
  readonly previewBlob: Blob;
  readonly freshProxy: PreviewProxy | null;
}

/**
 * Reads or generates a preview proxy. Does not touch the editor
 * store; publishing the resolved blob and persisting the fresh proxy
 * are both caller concerns.
 *
 * The proxy is an optimization, never a requirement: it makes
 * playback cheap, and the source plays without it. So generation
 * failures resolve to the source bytes rather than propagating.
 * Losing a smooth preview is a far smaller harm than discarding
 * everything the pipeline produced up to that point, which is what
 * a thrown error costs the person waiting on it.
 */
export class PreviewProxyResolver {
  constructor(
    private readonly repository: PreviewProxyRepository,
    private readonly generator: PreviewProxyGenerator,
    private readonly fallbackReporter: NonBlockingFailureReporter,
    private readonly enabled: boolean,
  ) {}

  private sizeInMb(source: Blob): number {
    return Math.round((source.size / (1024 * 1024)) * 10) / 10;
  }

  /**
   * Reads the proxy for `projectId` from the repository. Resolves to
   * `null` when the pipeline is disabled or the repository has no
   * proxy for the project.
   */
  async fromRepository(projectId: string): Promise<PreviewProxy | null> {
    if (!this.enabled) return null;
    return this.repository.load(projectId);
  }

  /**
   * Generates a fresh proxy from `source`. Resolves to the `source`
   * bytes verbatim as `previewBlob` and a `null` `freshProxy` when
   * the pipeline is disabled, and equally when generation fails —
   * the failure is reported, not raised, so callers get a playable
   * blob in every case and never have to handle proxy errors.
   */
  async fromSource(
    source: Blob,
    onProgress?: PreviewProxyProgressCallback,
  ): Promise<PreviewProxyResolution> {
    if (!this.enabled) return { previewBlob: source, freshProxy: null };
    try {
      const proxy = await this.generator.generate(source, onProgress);
      return { previewBlob: proxy.blob, freshProxy: proxy };
    } catch (cause) {
      console.error('[preview-proxy] generation failed, continuing on the source', cause);
      this.fallbackReporter.report(cause, { source_size_mb: this.sizeInMb(source) });
      return { previewBlob: source, freshProxy: null };
    }
  }
}
