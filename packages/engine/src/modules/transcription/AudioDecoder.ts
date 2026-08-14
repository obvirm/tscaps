/**
 * Decodes an audio/video Blob to mono PCM at the requested sample rate.
 * Implementations choose how to do this — using browser Web Audio APIs,
 * demuxing the container first, or trusting a pre-decoded byte stream —
 * so the decode strategy is decoupled from the consumer and from the
 * platform (main thread vs Worker context).
 *
 * `onProgress` receives a `[0, 1]` value reflecting how much of the
 * source has been decoded so far. Implementations are best-effort and
 * may not call it at all when the underlying backend does not report
 * incremental progress.
 */
export interface AudioDecoder {
  decode(
    audio: Blob,
    targetSampleRate: number,
    onProgress?: (progress: number) => void,
  ): Promise<Float32Array>;
}
