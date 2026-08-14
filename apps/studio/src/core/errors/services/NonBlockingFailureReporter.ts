import type { AppError } from '@core/errors/domain/AppError';
import type { StorageFootprintProbe } from '@core/_shared/infrastructure/StorageFootprintProbe';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';
import type { TelemetryEventProperties } from '@shared/telemetry';

/**
 * Announces a failure the app recovered from, on the two channels a
 * recovered failure still needs.
 *
 * The notice explains to the person at the screen what degraded,
 * without taking the screen away from them. The telemetry event
 * keeps the failure countable: a failure that stops aborting anything
 * also stops being reported by the paths that watch for aborts, and
 * would otherwise go silent exactly when it starts happening often.
 *
 * Each instance reports one kind of failure, named by the event it
 * captures. The originating error travels whole, cause included —
 * which is what lets the rendering boundary tell apart failures that
 * share a name but not a remedy — alongside a reading of how full the
 * origin's storage was, since that is the condition behind most
 * failures worth recovering from and the error alone never says.
 *
 * The notice is published straight away; the event waits on that
 * reading, which is why nothing awaits `report`.
 */
export class NonBlockingFailureReporter {
  constructor(
    private readonly telemetry: Telemetry,
    private readonly noticeChannel: AppNoticeChannel,
    private readonly errorClassifier: AppErrorClassifier,
    private readonly errorTelemetryDescriber: AppErrorTelemetryDescriber,
    private readonly storageFootprintProbe: StorageFootprintProbe,
    private readonly telemetryEvent: TelemetryEventName,
  ) {}

  /**
   * Reports `cause`. Anything the caller knows that the error does not
   * carry travels in `context` and lands on the event verbatim.
   */
  report(cause: unknown, context: TelemetryEventProperties = {}): void {
    const appError = this.errorClassifier.wrap(cause);
    void this.capture(appError, context);
    this.noticeChannel.publish(appError);
  }

  private async capture(appError: AppError, context: TelemetryEventProperties): Promise<void> {
    const storage = await this.storageFootprintProbe.measure();
    this.telemetry.capture(this.telemetryEvent, {
      ...this.errorTelemetryDescriber.describe(appError),
      ...storage,
      ...context,
    });
  }
}
