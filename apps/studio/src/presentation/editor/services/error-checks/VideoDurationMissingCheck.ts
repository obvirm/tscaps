import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorErrorCheck, EditorErrorDetection } from '@presentation/editor/services/error-checks/EditorErrorCheck';
import { VideoDurationUnreadableError } from '@core/videos/domain/errors/VideoDurationUnreadableError';

/**
 * Detects the anomaly of a video that finished loading into the
 * preview surface without a readable duration — the source file is
 * present, the surface reports ready, and the duration is zero. The
 * dedupe key is the source `File` so a fresh import re-arms the
 * check and a later duration write settles it silently.
 */
export class VideoDurationMissingCheck implements EditorErrorCheck {
  detect(state: EditorState): EditorErrorDetection | null {
    const { video } = state;
    if (video.file === null) return null;
    if (!video.isReady) return null;
    if (video.duration > 0) return null;
    return {
      error: new VideoDurationUnreadableError({
        fileName: video.fileName,
        mimeType: video.mimeType,
        size: video.size,
      }),
      dedupeKey: video.file,
    };
  }
}
