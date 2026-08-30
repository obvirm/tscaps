/**
 * Raised when no decoder the factory is allowed to use can handle the
 * input's video track. Fired before any frame is decoded.
 *
 * The `.name` string is set explicitly, and exposed as `ERROR_NAME` on
 * the class, so consumers can recognise the failure across a boundary
 * that preserves string fields but not class identity — a Worker, or a
 * browser driven from outside the page.
 */
export class VideoFrameDecoderSelectionFailedError extends Error {
  static readonly ERROR_NAME = 'VideoFrameDecoderSelectionFailedError';
  readonly name = VideoFrameDecoderSelectionFailedError.ERROR_NAME;
}
