import type { EditorStore } from '@core/editor/store/EditorStore';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import { ProjectVideoStoreFailedError } from '@core/projects/domain/errors/ProjectVideoStoreFailedError';
import type { PersonSegmentationCacheRepository } from '@core/person-segmentation/domain/PersonSegmentationCacheRepository';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { PreviewProxy } from '@core/preview/domain/PreviewProxy';
import type { PreviewProxyRepository } from '@core/preview/domain/PreviewProxyRepository';
import type { PreviewProxyResolver } from '@core/preview/services/PreviewProxyResolver';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/**
 * Re-attaches a freshly chosen video file to a project whose cached
 * blob was evicted by the LRU policy. Trusts the user that the file
 * matches the project — a wrong file only misaligns timings and is
 * recoverable by picking again.
 *
 * Publishes a preview proxy from the recovered file before handing
 * control back to the editor, so the preview surface has something
 * to load the moment the splash clears.
 *
 * Keeping a copy of the file for later is best-effort and reported
 * as a notice when it fails; the recovery itself still succeeds.
 * Raises when the chosen file cannot be decoded at all.
 */
export class RecoverProjectVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly repository: ProjectRepository,
    private readonly previewProxyResolver: PreviewProxyResolver,
    private readonly proxyRepository: PreviewProxyRepository,
    private readonly personSegmentationCache: PersonSegmentationCacheRepository,
    private readonly compatibilityChecker: VideoCompatibilityChecker,
    private readonly metadataProbe: VideoMetadataProbe,
    private readonly storeFailureReporter: NonBlockingFailureReporter,
  ) {}

  async execute(file: File): Promise<void> {
    const snap = this.store.snapshot();
    if (!snap.projectId) throw new Error('No project loaded');
    const projectId = snap.projectId;

    await this.compatibilityChecker.check(file);

    if (snap.video.url) URL.revokeObjectURL(snap.video.url);

    await this.keepCopyBestEffort(projectId, file);
    await this.personSegmentationCache.delete(projectId);
    await this.publishPreviewProxy(projectId, file);
    const metadata = await this.probeOriginalMetadata(file);

    this.store.patch({
      video: {
        file,
        url: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        ...this.layoutFrom(metadata),
      },
      status: 'idle',
      error: null,
    });
  }

  /**
   * The file is in hand and the session can edit and export from it
   * without ever reaching storage, so a device with no room left is
   * not a reason to refuse the recovery the reader just performed.
   * What is lost is the next open, which will ask for the file again
   * — worth a notice, not a dead end.
   */
  private async keepCopyBestEffort(projectId: string, file: File): Promise<void> {
    try {
      await this.repository.cacheVideoBlob(projectId, file);
    } catch (cause) {
      // Reaching the recovery prompt at all means the server had no
      // copy either, so the next open asks for the file again.
      this.storeFailureReporter.report(new ProjectVideoStoreFailedError({ cause, hasRemoteCopy: false }));
    }
  }

  private async publishPreviewProxy(projectId: string, source: Blob): Promise<void> {
    const cached = await this.previewProxyResolver.fromRepository(projectId);
    if (cached) {
      this.store.patchVideo({ preview: { kind: 'proxy', file: cached.blob } });
      return;
    }
    const resolution = await this.previewProxyResolver.fromSource(source);
    this.store.patchVideo({ preview: resolution.preview });
    if (resolution.freshProxy) this.dispatchProxyStore(projectId, resolution.freshProxy);
  }

  private async probeOriginalMetadata(file: File): Promise<VideoSourceMetadata | null> {
    try {
      return await this.metadataProbe.probe(file);
    } catch {
      return null;
    }
  }

  private layoutFrom(metadata: VideoSourceMetadata | null): { layout?: { width: number; height: number } } {
    if (!metadata) return {};
    if (metadata.videoWidthPx === null || metadata.videoHeightPx === null) return {};
    return { layout: { width: metadata.videoWidthPx, height: metadata.videoHeightPx } };
  }

  private dispatchProxyStore(projectId: string, proxy: PreviewProxy): void {
    void this.proxyRepository.store(projectId, proxy).catch((error) => {
      console.error('[recover-project-video] preview-proxy store failed', error);
    });
  }
}
