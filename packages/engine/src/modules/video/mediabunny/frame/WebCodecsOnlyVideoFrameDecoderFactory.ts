import type { VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type {
  VideoFrameDecoderFactory,
  VideoFrameDecoderRequest,
} from '@modules/video/mediabunny/frame/VideoFrameDecoderFactory';
import { VideoFrameDecoderSelectionFailedError } from '@modules/video/mediabunny/frame/VideoFrameDecoderSelectionFailedError';
import { WebCodecsVideoFrameDecoder } from '@modules/video/mediabunny/frame/WebCodecsVideoFrameDecoder';

/**
 * Returns the WebCodecs decoder or nothing at all.
 *
 * The `<video>` element fallback the default factory reaches for is
 * bounded by playback speed, so a host that decodes a source only that
 * way is better served by rewriting the source than by driving it. This
 * factory makes that refusal explicit instead of quietly taking the
 * slow path: it raises {@link VideoFrameDecoderSelectionFailedError},
 * and whoever asked decides what to rewrite.
 */
export class WebCodecsOnlyVideoFrameDecoderFactory implements VideoFrameDecoderFactory {

  async create(request: VideoFrameDecoderRequest): Promise<VideoFrameDecoder> {
    const inputCodec = (await request.track.getCodec()) ?? 'unknown';
    if (!(await request.track.canDecode())) {
      throw new VideoFrameDecoderSelectionFailedError(
        `WebCodecs cannot decode the input video codec (${inputCodec}).`,
      );
    }
    request.onDecoderSelected?.({ kind: 'web-codecs', inputCodec });
    return new WebCodecsVideoFrameDecoder(request.track);
  }
}
