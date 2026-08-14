import {
  ALL_FORMATS,
  BlobSource,
  Input,
  Mp4OutputFormat,
  VideoSampleSink,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type InputVideoTrack,
} from 'mediabunny';
import type { VideoCompatibilityChecker } from '@core/videos/domain/VideoCompatibilityChecker';
import { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';
import { UnsupportedAudioCodecError } from '@core/videos/domain/errors/UnsupportedAudioCodecError';

/**
 * mediabunny-backed implementation of {@link VideoCompatibilityChecker}.
 * Opens the source through `Input`, reads codec metadata, and decodes
 * exactly one video frame to prove the browser's decoder handles the
 * real bitstream, then closes the input before returning. Audio is
 * checked from metadata only.
 */
export class MediaBunnyVideoCompatibilityChecker implements VideoCompatibilityChecker {
  private static readonly PROXY_TARGET_VIDEO_CODEC = 'avc';

  async check(source: Blob): Promise<void> {
    const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
    try {
      await this.checkVideoDecodable(input);
      await this.checkProxyVideoEncoderAvailable();
      await this.checkAudioCarriable(input);
    } finally {
      input.dispose();
    }
  }

  private async checkVideoDecodable(input: Input): Promise<void> {
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      throw new UnsupportedVideoCodecError({ codec: 'none' });
    }
    if (!(await track.canDecode())) {
      throw new UnsupportedVideoCodecError({ codec: await this.readVideoCodec(track) });
    }
    await this.checkFirstFrameDecodes(track);
  }

  /**
   * `canDecode` only asks the browser whether a decoder for the codec
   * string exists; browsers answer yes and still fail on the actual
   * bitstream (hardware profile limits, corrupt samples). Decoding one
   * real frame catches those upfront instead of deep inside a later
   * pipeline stage.
   */
  private async checkFirstFrameDecodes(track: InputVideoTrack): Promise<void> {
    try {
      const sink = new VideoSampleSink(track);
      const sample = await sink.getSample(await track.getFirstTimestamp());
      if (!sample) {
        throw new Error('The decoder produced no sample for the first frame.');
      }
      sample.close();
    } catch (cause) {
      throw new UnsupportedVideoCodecError({ codec: await this.readVideoCodec(track), cause });
    }
  }

  private async readVideoCodec(track: InputVideoTrack): Promise<string> {
    return (await track.getCodec()) ?? 'unknown';
  }

  /**
   * Defensive check that the browser ships an H.264 encoder. Every
   * WebCodecs browser does in practice, but a missing encoder would
   * otherwise surface as an opaque conversion failure deep inside
   * proxy generation.
   */
  private async checkProxyVideoEncoderAvailable(): Promise<void> {
    const codec = MediaBunnyVideoCompatibilityChecker.PROXY_TARGET_VIDEO_CODEC;
    const encodable = await getFirstEncodableVideoCodec([codec]);
    if (encodable) return;
    throw new UnsupportedVideoCodecError({ codec: `${codec}-encoder` });
  }

  private async checkAudioCarriable(input: Input): Promise<void> {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return;
    const codec = await track.getCodec();
    if (!codec) throw new UnsupportedAudioCodecError({ codec: 'unknown' });
    if (!(await track.canDecode())) throw new UnsupportedAudioCodecError({ codec });
    await this.assertAudioCodecHasContainerPath(codec);
  }

  /**
   * Confirms there is some way to carry the source audio codec into
   * the proxy container — either because the container already
   * accepts it (passthrough) or because the browser can transcode to
   * one of the container's supported codecs.
   */
  private async assertAudioCodecHasContainerPath(sourceCodec: string): Promise<void> {
    const supported = new Mp4OutputFormat().getSupportedAudioCodecs();
    if ((supported as readonly string[]).includes(sourceCodec)) return;
    const transcodeTarget = await getFirstEncodableAudioCodec(supported);
    if (transcodeTarget) return;
    throw new UnsupportedAudioCodecError({ codec: sourceCodec });
  }
}
