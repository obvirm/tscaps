import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when the video could not be measured across every stretch a
 * caption using the text-behind-actor effect sits on.
 *
 * Reported rather than thrown. A stretch nobody could measure is one
 * the preview never showed either — playback is held wherever the
 * playhead sits on an unmeasured caption, and given up on only when
 * the measurement fails — so the burned file cannot contradict
 * anything the user watched. What the effect does there is turn off,
 * in the preview and in the file alike, and the only thing missing is
 * saying so.
 */
export class BehindActorMeasurementFailedError extends AppError {
  readonly name = 'BehindActorMeasurementFailedError';

  constructor(options?: { cause: unknown }) {
    super('The video could not be measured across every captioned stretch', options);
  }
}
