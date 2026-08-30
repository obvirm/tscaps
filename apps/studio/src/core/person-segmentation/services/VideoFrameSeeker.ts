/**
 * Drives an HTML video element through a sequence of timestamps,
 * awaiting each `seeked` event before yielding control. Wraps the
 * DOM event lifecycle in a plain awaitable so callers can `await`
 * a seek without wiring listeners each time.
 *
 * A seek settles one of three ways: the frame arrives, the element
 * reports it cannot decode, or the caller aborts. Nothing else keeps
 * the promise alive, so a walk over a video can always be brought to
 * an end.
 */
export class VideoFrameSeeker {

  /**
   * Moves `video` to `timestamp` and resolves once the frame is
   * showing. Rejects with the signal's reason when `signal` fires, and
   * with a decode error when the element gives up on the source.
   */
  seekTo(video: HTMLVideoElement, timestamp: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const stopListening = (): void => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        signal.removeEventListener('abort', onAbort);
      };
      const onSeeked = (): void => {
        stopListening();
        resolve();
      };
      const onError = (): void => {
        stopListening();
        reject(new Error(`Seeking to ${timestamp}s failed: ${video.error?.message ?? 'unknown decode error'}`));
      };
      const onAbort = (): void => {
        stopListening();
        reject(signal.reason);
      };
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      signal.addEventListener('abort', onAbort);
      video.currentTime = timestamp;
    });
  }
}
