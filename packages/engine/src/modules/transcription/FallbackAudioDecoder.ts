import type { AudioDecoder } from '@modules/transcription/AudioDecoder';

/**
 * `AudioDecoder` that runs a primary decoder and retries with a
 * fallback when the primary fails for any reason — a codec the
 * runtime cannot decode, but also a decoder dying mid-stream, which
 * a different decode strategy may survive. Genuinely broken input
 * costs one extra attempt that fails fast.
 *
 * When both fail it throws an `AggregateError` whose `errors` are the
 * primary's and the fallback's, in that order — neither caused the
 * other, so neither can be the other's `cause`. Its message names
 * both reasons, so a report that keeps only the outer error still
 * says which attempt died of what.
 *
 * Progress callbacks are forwarded to whichever decoder ends up
 * producing the result; a fallback run restarts progress from zero.
 */
export class FallbackAudioDecoder implements AudioDecoder {

  constructor(
    private readonly primary: AudioDecoder,
    private readonly fallback: AudioDecoder,
  ) {}

  async decode(
    audio: Blob,
    targetSampleRate: number,
    onProgress?: (progress: number) => void,
  ): Promise<Float32Array> {
    let primaryError: unknown;
    try {
      return await this.primary.decode(audio, targetSampleRate, onProgress);
    } catch (error) {
      primaryError = error;
    }
    try {
      return await this.fallback.decode(audio, targetSampleRate, onProgress);
    } catch (fallbackError) {
      throw new AggregateError(
        [primaryError, fallbackError],
        `No audio decode path succeeded. Primary: ${this.describe(primaryError)}.`
        + ` Fallback: ${this.describe(fallbackError)}`,
        { cause: fallbackError },
      );
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
  }
}
