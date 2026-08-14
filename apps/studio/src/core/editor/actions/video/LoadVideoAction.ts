import type { EditorStore } from '@core/editor/store/EditorStore';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';

/**
 * Loads a freshly chosen video file into the editor as a brand-new editing
 * session. Delegates the full reset to `store.reset()` so the next
 * persistence event creates a new Project from the same baseline as a
 * freshly initialised app, not from whatever the previous project left
 * behind in the shared store.
 *
 * The reset is synchronous — route guards and first-paint flows read
 * `video.file` immediately after this call returns. The container is
 * probed in the background and `video.duration` plus
 * `video.hasAudioTrack` are patched in as soon as the probe lands;
 * consumers that gate on those facts subscribe to the store and pick
 * the values up on that change. A probe failure leaves the duration
 * at `0` and the audio presence at `null`.
 *
 * LoadProjectAction is the counterpart for opening an existing Project from
 * the dashboard; it patches the same fields directly without going through
 * this action.
 */
export class LoadVideoAction {
  constructor(
    private readonly store: EditorStore,
    private readonly metadataProbe: VideoMetadataProbe,
  ) {}

  execute(file: File): void {
    const { video } = this.store.snapshot();
    if (video.url) URL.revokeObjectURL(video.url);
    this.store.reset({
      video: {
        file,
        url: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        isProbing: true,
      },
    });
    void this.patchProbedFactsWhenSettled(file);
  }

  private async patchProbedFactsWhenSettled(file: File): Promise<void> {
    try {
      const metadata = await this.metadataProbe.probe(file);
      // A later load or clear may have replaced the video while the
      // probe ran; stale facts must not leak into the new state.
      if (this.store.snapshot().video.file !== file) return;
      if (metadata.durationSeconds !== null) this.store.setDuration(metadata.durationSeconds);
      this.store.setHasAudioTrack(metadata.hasAudioTrack);
    } catch (err) {
      console.warn('[load-video] metadata probe failed', err);
    } finally {
      if (this.store.snapshot().video.file === file) this.store.setIsProbing(false);
    }
  }
}
