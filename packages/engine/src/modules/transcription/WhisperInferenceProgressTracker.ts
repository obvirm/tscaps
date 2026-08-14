/**
 * Turns Whisper's chunk-relative timestamp stream into a monotonic
 * fraction of the inference work done so far, in
 * `[0, MAX_STREAMING_FRACTION]`.
 *
 * The transformers.js pipeline slices audio into fixed windows of
 * `chunkLengthSeconds` and slides them by `chunkLengthSeconds - 2 *
 * strideLengthSeconds`, decoding each window independently. Whisper's
 * predicted timestamps restart at zero on every window, so a backward
 * step in the observed stream is treated as the boundary between two
 * pipeline windows. Small backward jitter *within* a window (the
 * decoder occasionally re-emits an earlier timestamp) is tolerated up
 * to `INTRA_CHUNK_TOLERANCE_SECONDS`.
 *
 * Progress is measured against the audio each window decodes, not
 * against the position reached in the source. Consecutive windows
 * overlap by `2 * strideLengthSeconds`, and that overlap is decoded
 * twice: a position-based fraction cannot advance until a new window
 * has re-decoded everything the previous one already covered, which
 * shows up as the bar sitting frozen for the first third of every
 * window. Counting each window's own audio makes the fraction track
 * the decoder's actual cost instead.
 *
 * The returned fraction never decreases and never reaches `1`:
 * Whisper still runs a word-timestamp post-processing pass after the
 * last streamed segment, so a strictly-below-one ceiling leaves room
 * for the caller to emit the terminal `1` from outside the streamer
 * once the whole call actually completes.
 */
export class WhisperInferenceProgressTracker {
  private static readonly INTRA_CHUNK_TOLERANCE_SECONDS = 1;
  private static readonly MAX_STREAMING_FRACTION = 0.95;

  private readonly windowSeconds: number[];
  private readonly totalWorkSeconds: number;
  private readonly windowAdvanceSeconds: number;

  private currentWindowIndex = 0;
  private workBeforeCurrentWindow = 0;
  private lastReportedChunkTime = 0;
  private lastFraction = 0;

  constructor(
    durationSeconds: number,
    chunkLengthSeconds: number,
    strideLengthSeconds: number,
  ) {
    this.windowAdvanceSeconds = Math.max(1, chunkLengthSeconds - 2 * strideLengthSeconds);
    this.windowSeconds = this.measureWindows(durationSeconds, chunkLengthSeconds);
    this.totalWorkSeconds = this.windowSeconds.reduce((total, seconds) => total + seconds, 0);
  }

  /** The audio each pipeline window decodes, in window order. */
  get windowLayout(): readonly number[] {
    return this.windowSeconds;
  }

  /** How far the pipeline slides between consecutive windows, in seconds. */
  get advanceSeconds(): number {
    return this.windowAdvanceSeconds;
  }

  /**
   * Feeds a chunk-relative timestamp and returns the resulting monotonic
   * progress fraction over the whole inference.
   */
  observeChunkEnd(timeWithinChunk: number): number {
    if (this.isNewPipelineWindow(timeWithinChunk)) {
      this.advanceWindow();
    }
    this.lastReportedChunkTime = timeWithinChunk;
    this.lastFraction = Math.max(this.lastFraction, this.fractionAt(timeWithinChunk));
    return this.lastFraction;
  }

  /**
   * Reproduces the window layout the transformers.js ASR pipeline builds
   * for this audio, as the amount of audio each window carries. The last
   * window is short whenever the audio does not end on a window boundary.
   */
  private measureWindows(
    durationSeconds: number,
    chunkLengthSeconds: number,
  ): number[] {
    const advance = this.windowAdvanceSeconds;
    const windows: number[] = [];
    for (let start = 0; ; start += advance) {
      windows.push(Math.min(chunkLengthSeconds, durationSeconds - start));
      if (start + chunkLengthSeconds >= durationSeconds) return windows;
    }
  }

  private isNewPipelineWindow(timeWithinChunk: number): boolean {
    const tolerance = WhisperInferenceProgressTracker.INTRA_CHUNK_TOLERANCE_SECONDS;
    return timeWithinChunk < this.lastReportedChunkTime - tolerance;
  }

  // Whisper can report more boundaries than the layout predicts; staying on
  // the last window keeps the fraction below its ceiling instead of overshooting.
  private advanceWindow(): void {
    if (this.currentWindowIndex >= this.windowSeconds.length - 1) return;
    this.workBeforeCurrentWindow += this.currentWindowSeconds();
    this.currentWindowIndex += 1;
  }

  private currentWindowSeconds(): number {
    return this.windowSeconds[this.currentWindowIndex] ?? 0;
  }

  private fractionAt(timeWithinChunk: number): number {
    if (this.totalWorkSeconds <= 0) return 0;
    const workWithinWindow = Math.min(Math.max(timeWithinChunk, 0), this.currentWindowSeconds());
    const fraction = (this.workBeforeCurrentWindow + workWithinWindow) / this.totalWorkSeconds;
    return Math.min(WhisperInferenceProgressTracker.MAX_STREAMING_FRACTION, fraction);
  }
}
