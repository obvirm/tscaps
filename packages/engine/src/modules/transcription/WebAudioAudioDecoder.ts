import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import type { AudioDecoder } from '@modules/transcription/AudioDecoder';
import { MediaBunnyAudioOnlyRemuxer } from '@modules/transcription/MediaBunnyAudioOnlyRemuxer';
import type { AudioOnlySegment } from '@modules/transcription/MediaBunnyAudioOnlyRemuxer';

/**
 * Decodes an audio/video Blob to mono `Float32Array` PCM at the
 * requested sample rate through the Web Audio API. `decodeAudioData`
 * ships everywhere, so this covers runtimes whose WebCodecs has no
 * `AudioDecoder` (Safari before 26 is video-only).
 *
 * Peak memory does not follow the source's length: the audio track is
 * decoded in bounded segments into one pre-sized buffer, so the cost
 * is that buffer plus a single segment. The video track never loads.
 *
 * Main-thread only — `OfflineAudioContext` is not available inside
 * Worker contexts.
 *
 * Throws a `DOMException` named `NotSupportedError` for audio it
 * cannot decode and for a container it cannot read, following the
 * WebCodecs convention so callers classify both decode paths alike.
 */
export class WebAudioAudioDecoder implements AudioDecoder {

  private static readonly DEFAULT_SEGMENT_SECONDS = 60;

  private readonly remuxer = new MediaBunnyAudioOnlyRemuxer();

  /**
   * @param segmentSeconds - How much source audio one
   * `decodeAudioData` call covers. Trades peak memory against
   * per-segment setup; the decoded result is the same at any value.
   */
  constructor(
    private readonly segmentSeconds: number = WebAudioAudioDecoder.DEFAULT_SEGMENT_SECONDS,
  ) {}

  async decode(
    audio: Blob,
    targetSampleRate: number,
    onProgress?: (progress: number) => void,
  ): Promise<Float32Array> {
    const durationSeconds = await this.audioDurationOf(audio);
    if (durationSeconds === null) return new Float32Array(0);

    const target = new Float32Array(Math.max(1, Math.ceil(durationSeconds * targetSampleRate)));
    let written = 0;
    for await (const segment of this.segmentsOf(audio)) {
      const decoded = await this.decodeWithWebAudio(await segment.bytes.arrayBuffer(), targetSampleRate);
      const skipped = Math.round((segment.usableFromSeconds - segment.startSeconds) * targetSampleRate);
      const offset = Math.round(segment.usableFromSeconds * targetSampleRate);
      written = Math.max(written, this.mixIntoTarget(target, decoded, skipped, offset));
      if (onProgress) {
        onProgress(Math.min(1, (segment.startSeconds + decoded.duration) / durationSeconds));
      }
    }
    if (onProgress) onProgress(1);
    return target.subarray(0, written);
  }

  private async *segmentsOf(audio: Blob): AsyncGenerator<AudioOnlySegment> {
    try {
      yield* this.remuxer.remuxSegments(audio, this.segmentSeconds);
    } catch (cause) {
      throw this.notSupported('The audio track could not be read out of its container', cause);
    }
  }

  /**
   * Returns the length of the source's primary audio track, or
   * `null` when it carries none.
   */
  private async audioDurationOf(audio: Blob): Promise<number | null> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(audio) });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) return null;
      const durationSeconds = await track.computeDuration();
      return durationSeconds > 0 ? durationSeconds : null;
    } catch (cause) {
      throw this.notSupported('The source container could not be read', cause);
    } finally {
      input.dispose();
    }
  }

  private async decodeWithWebAudio(bytes: ArrayBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    // decodeAudioData resamples to the context's rate, so a context
    // created at the target rate does the resampling in the same pass.
    const context = new OfflineAudioContext(1, 1, targetSampleRate);
    try {
      return await context.decodeAudioData(bytes);
    } catch (cause) {
      throw this.notSupported('Audio is not decodable by the Web Audio API', cause);
    }
  }

  /**
   * Downmixes the decoded segment into the target, dropping its
   * first `skipped` frames and laying the rest down from `offset`,
   * clipped to the target's capacity. Returns the index one past the
   * last frame written.
   */
  private mixIntoTarget(
    target: Float32Array,
    decoded: AudioBuffer,
    skipped: number,
    offset: number,
  ): number {
    const source = Math.max(0, skipped);
    const start = Math.max(0, offset);
    const frames = Math.min(decoded.length - source, target.length - start);
    if (frames <= 0) return 0;

    const channels = decoded.numberOfChannels;
    const first = decoded.getChannelData(0);
    for (let frame = 0; frame < frames; frame += 1) target[start + frame] = first[source + frame]!;
    for (let channel = 1; channel < channels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let frame = 0; frame < frames; frame += 1) target[start + frame]! += data[source + frame]!;
    }
    if (channels > 1) {
      const inverseChannels = 1 / channels;
      for (let frame = 0; frame < frames; frame += 1) target[start + frame]! *= inverseChannels;
    }
    return start + frames;
  }

  private notSupported(what: string, cause: unknown): DOMException {
    const reason = cause instanceof Error ? cause.message : String(cause);
    return new DOMException(`${what}: ${reason}`, 'NotSupportedError');
  }
}
