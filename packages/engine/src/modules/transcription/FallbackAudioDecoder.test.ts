import { describe, expect, it } from 'vitest';
import type { AudioDecoder } from '@modules/transcription/AudioDecoder';
import { FallbackAudioDecoder } from '@modules/transcription/FallbackAudioDecoder';

class FixedAudioDecoder implements AudioDecoder {
  constructor(private readonly pcm: Float32Array) {}
  async decode(): Promise<Float32Array> { return this.pcm; }
}

class FailingAudioDecoder implements AudioDecoder {
  constructor(private readonly error: Error) {}
  async decode(): Promise<Float32Array> { throw this.error; }
}

const AUDIO = new Blob([new Uint8Array([1, 2, 3])]);

function notSupported(): DOMException {
  return new DOMException('no decode path for this codec', 'NotSupportedError');
}

describe('FallbackAudioDecoder', () => {
  it('returns the primary result when the primary can decode', async () => {
    const primaryPcm = new Float32Array([0.1, 0.2]);
    const decoder = new FallbackAudioDecoder(
      new FixedAudioDecoder(primaryPcm),
      new FixedAudioDecoder(new Float32Array([0.9])),
    );
    await expect(decoder.decode(AUDIO, 16000)).resolves.toBe(primaryPcm);
  });

  it('decodes through the fallback when the primary reports the audio unsupported', async () => {
    const fallbackPcm = new Float32Array([0.5, 0.6]);
    const decoder = new FallbackAudioDecoder(
      new FailingAudioDecoder(notSupported()),
      new FixedAudioDecoder(fallbackPcm),
    );
    await expect(decoder.decode(AUDIO, 16000)).resolves.toBe(fallbackPcm);
  });

  it('decodes through the fallback when the primary dies mid-stream', async () => {
    const fallbackPcm = new Float32Array([0.9]);
    const decoder = new FallbackAudioDecoder(
      new FailingAudioDecoder(new DOMException('decoder died mid-stream', 'EncodingError')),
      new FixedAudioDecoder(fallbackPcm),
    );
    await expect(decoder.decode(AUDIO, 16000)).resolves.toBe(fallbackPcm);
  });

  it('carries both attempts when neither can decode', async () => {
    const primaryUnsupported = notSupported();
    const fallbackFailure = new DOMException('remux produced no output', 'EncodingError');
    const decoder = new FallbackAudioDecoder(
      new FailingAudioDecoder(primaryUnsupported),
      new FailingAudioDecoder(fallbackFailure),
    );

    const error = await decoder.decode(AUDIO, 16000).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([primaryUnsupported, fallbackFailure]);
  });

  /**
   * The fallback's reason used to be dropped on the floor, which left
   * a double failure reporting the reason of the attempt that was
   * always going to fail on that runtime. The flattened message is
   * what a reader gets when only the outer error survives the trip to
   * a log or a telemetry field, so both reasons have to be in it.
   */
  it('names both reasons in the message a flattened report keeps', async () => {
    const decoder = new FallbackAudioDecoder(
      new FailingAudioDecoder(notSupported()),
      new FailingAudioDecoder(new DOMException('out of memory', 'QuotaExceededError')),
    );

    const error = await decoder.decode(AUDIO, 16000).catch((thrown: unknown) => thrown);

    expect((error as Error).message).toContain('no decode path for this codec');
    expect((error as Error).message).toContain('out of memory');
  });
});
