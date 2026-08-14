import { AppError } from '@core/errors/domain/AppError';
import { UnknownAppError } from '@core/errors/domain/UnknownAppError';

/**
 * Promotes any thrown value into the typed `AppError` hierarchy.
 *
 * Values that already extend `AppError` pass through unchanged.
 * Anything else is wrapped in `UnknownAppError`, preserving the
 * original value in `cause` so telemetry and support tooling retain
 * the full context. The classifier guarantees that downstream
 * consumers always see an `AppError`.
 */
export class AppErrorClassifier {
  wrap(err: unknown): AppError {
    if (err instanceof AppError) return err;
    return new UnknownAppError({ cause: err });
  }
}
