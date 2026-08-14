import {
  ALL_FORMATS,
  AudioSampleSink,
  BlobSource,
  Input,
  type AudioSample,
  type InputAudioTrack,
} from 'mediabunny';
import type { AudioDecoder } from '@modules/transcription/AudioDecoder';
import { BatchedMonoResampler } from '@modules/transcription/BatchedMonoResampler';

/**
 * Decodes an audio/video Blob to mono `Float32Array` PCM at the
 * requested sample rate by demuxing the container with mediabunny and
 * iterating the primary audio track through {@link AudioSampleSink}.
 * Downmixes and resamples in fixed-size batches via
 * {@link BatchedMonoResampler} so peak memory is bounded by one batch
 * of source-rate audio plus the pre-sized target buffer, not by the
 * whole track — a long video no longer holds ~4× its useful PCM size
 * in transient buffers on the way to the worker.
 *
 * Main-thread only — `OfflineAudioContext` is not available inside
 * Worker contexts.
 *
 * A codec the current browser cannot decode surfaces as a
 * `DOMException` named `NotSupportedError`, following the WebCodecs
 * convention. Any other underlying mediabunny / WebCodecs failure is
 * re-thrown verbatim so callers can inspect its `name` / `cause` to
 * classify the reason.
 */
export class MediaBunnyAudioDecoder implements AudioDecoder {
  async decode(
    audio: Blob,
    targetSampleRate: number,
    onProgress?: (progress: number) => void,
  ): Promise<Float32Array> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(audio) });
    try {
      return await this.decodeInput(input, targetSampleRate, onProgress);
    } finally {
      input.dispose();
    }
  }

  private async decodeInput(
    input: Input,
    targetSampleRate: number,
    onProgress?: (progress: number) => void,
  ): Promise<Float32Array> {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return new Float32Array(0);
    if (!(await track.canDecode())) {
      const codec = await track.getCodec();
      throw new DOMException(
        `Audio codec is not supported by this browser: ${codec ?? 'unknown'}`,
        'NotSupportedError',
      );
    }
    const durationSeconds = await track.computeDuration();
    if (durationSeconds <= 0) return new Float32Array(0);

    const target = new Float32Array(Math.max(1, Math.ceil(durationSeconds * targetSampleRate)));
    const resampler = new BatchedMonoResampler(target, targetSampleRate);
    const written = await this.streamMonoInto(track, resampler, durationSeconds, onProgress);
    return target.subarray(0, written);
  }

  private async streamMonoInto(
    track: InputAudioTrack,
    resampler: BatchedMonoResampler,
    durationSeconds: number,
    onProgress?: (progress: number) => void,
  ): Promise<number> {
    const sink = new AudioSampleSink(track);
    for await (const sample of sink.samples(0)) {
      try {
        await resampler.append(sample);
        if (onProgress) onProgress(this.progressAt(sample, durationSeconds));
      } finally {
        sample.close();
      }
    }
    if (onProgress) onProgress(1);
    return resampler.flush();
  }

  private progressAt(sample: AudioSample, durationSeconds: number): number {
    const decodedSeconds = sample.timestamp + sample.numberOfFrames / sample.sampleRate;
    if (durationSeconds <= 0) return 0;
    const ratio = decodedSeconds / durationSeconds;
    if (ratio < 0) return 0;
    if (ratio > 1) return 1;
    return ratio;
  }
}
