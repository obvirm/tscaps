import type { PlaybackGate } from '@core/person-segmentation/domain/PlaybackGate';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';

/** {@link PlaybackGate} over the editor's preview surface. */
export class PreviewSurfacePlaybackGate implements PlaybackGate {

  constructor(private readonly surface: VideoPreviewSurface) {}

  play(): Promise<void> {
    return this.surface.play();
  }

  pause(): void {
    this.surface.pause();
  }

  isPlaying(): boolean {
    return this.surface.snapshot().isPlaying;
  }
}
