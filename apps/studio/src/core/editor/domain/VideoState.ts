/**
 * Intrinsic dimensions of the video, captured from the `<video>` element once metadata loads.
 */
export interface VideoLayout {
  width: number;
  height: number;
}

/**
 * Failure captured from the `<video>` element's `error` event. `code`
 * matches `MediaError.code` (1: aborted, 2: network, 3: decode, 4:
 * src not supported).
 */
export interface VideoLoadError {
  code: number;
  message: string;
}

/**
 * Everything tied to the underlying video: its source, its load state, and
 * its live playback state. `file` / `url` are null until a video is loaded;
 * `volume` / `playbackRate` are user preferences that persist across resets.
 *
 * `fileName`, `mimeType`, and `size` mirror the identity of the loaded
 * original. They are kept independent of `file` so a project that knows
 * its original (by name, type, size) can be saved and exported while
 * the bytes are still being fetched asynchronously from the backing
 * store. They are populated whenever the editor commits to an
 * original — fresh drop, project load, or recovery — and cleared on
 * reset.
 */
export interface VideoState {
  readonly file: File | null;
  readonly url: string | null;
  /**
   * Re-encoded 480p H.264 version of `file`, generated during the
   * preprocessing pipeline and loaded by the preview surface in
   * place of the original. `null` until generation completes.
   * Export keeps using `file`.
   */
  readonly previewFile: Blob | null;
  /**
   * Whether `previewFile` holds a real proxy rather than the original
   * bytes. The preview surface plays the source verbatim when the
   * proxy pipeline is off and when generation failed, so a non-null
   * `previewFile` on its own says nothing about the quality on
   * screen. Consumers describing the preview to the user read this.
   */
  readonly previewIsProxy: boolean;
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly size: number | null;
  readonly layout: VideoLayout | null;
  /**
   * `true` once the `<video>` element has decoded enough data to render its
   * first frame (the `loadeddata` event).
   */
  readonly isReady: boolean;
  /** `null` while the video is loading or playing fine. */
  readonly loadError: VideoLoadError | null;
  readonly currentTime: number;
  readonly duration: number;
  /**
   * `true` between the moment a fresh video is loaded and the moment
   * the metadata probe finishes writing `duration` back into the
   * store. Consumers that gate on the true duration (validators,
   * eligibility checks) read this flag to know whether the value is
   * settled yet.
   */
  readonly isProbing: boolean;
  /**
   * `false` means the container was read and holds no audio track, so
   * there is no speech to transcribe. `null` while probing, when the
   * probe could not tell, or for videos restored without re-probing.
   */
  readonly hasAudioTrack: boolean | null;
  readonly volume: number;
  readonly playbackRate: number;
  readonly isPlaying: boolean;
}
