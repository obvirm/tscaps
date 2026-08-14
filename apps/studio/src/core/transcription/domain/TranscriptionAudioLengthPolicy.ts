/**
 * Explicit state of the transcription cap. Split into three cases so
 * consumers never have to guess whether `null` means "no cap applies"
 * or "the source hasn't loaded yet".
 */
export type TranscriptionAudioLengthCap =
  | { readonly state: 'resolving' }
  | { readonly state: 'no-cap' }
  | { readonly state: 'has-cap'; readonly seconds: number };

/**
 * Per-request duration cap for a transcription attempt. `enforce`
 * short-circuits an over-cap video before any expensive step (audio
 * extraction, upload) runs, so a rejection never spends work the
 * server would refuse anyway. `capState` exposes the current
 * ceiling so surfaces can render or gate on it before invoking the
 * pipeline.
 *
 * Implementations decide whether a cap applies at all. The
 * `resolving` state means "wait, the source of the cap hasn't
 * loaded yet"; callers must not treat it as "no cap".
 *
 * `subscribe` notifies listeners whenever the cap state changes
 * because any of its underlying sources moved. Returns an
 * unsubscribe function.
 */
export interface TranscriptionAudioLengthPolicy {
  capState(): TranscriptionAudioLengthCap;

  /**
   * Throws a typed `AppError` describing the overflow when the given
   * video duration exceeds the current cap. Returns without error
   * when the duration fits or when no cap applies. When the cap is
   * still `resolving`, the implementation must treat the call as a
   * hard failure to avoid a request that the server would refuse.
   */
  enforce(videoDurationSeconds: number): void;

  subscribe(listener: () => void): () => void;
}
