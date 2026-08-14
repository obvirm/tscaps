import type { ErrorReporter } from '@core/errors/domain/ErrorReporter';
import { CompositeErrorReporter } from '@core/errors/infrastructure/CompositeErrorReporter';
import { ConsoleErrorReporter } from '@core/errors/infrastructure/ConsoleErrorReporter';
import { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import { FailureReasonResolver } from '@core/errors/services/FailureReasonResolver';
import { BackendUnavailableFailureReasonRule } from '@core/errors/services/failure-reasons/BackendUnavailableFailureReasonRule';
import { StorageFullFailureReasonRule } from '@core/errors/services/failure-reasons/StorageFullFailureReasonRule';
import { UnsupportedCodecFailureReasonRule } from '@core/errors/services/failure-reasons/UnsupportedCodecFailureReasonRule';
import { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';

export interface ErrorsModule {
  readonly workerErrorMonitor: WorkerErrorMonitor;
  readonly errorClassifier: AppErrorClassifier;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly failureReasonResolver: FailureReasonResolver;
  readonly appNoticeChannel: AppNoticeChannel;
}

/**
 * Boots the errors feature: the three destinations a failure can take
 * and the vocabulary every feature describes one with.
 *
 * Every build reports crashes to the console; a build with a reporting
 * backend configured also sends the report there. The composite hides
 * which channels are active behind one port, and the worker monitor is
 * its only consumer — everything on the main thread is already covered
 * by the reporting SDK's own global handlers.
 *
 * Rules are listed most specific first — the resolver takes the first
 * match, so their order is the tie-break when one failure could be
 * described by two conditions.
 *
 * Boots before every feature module: the notice channel and the
 * classifier are dependencies of the wirings that own the operations
 * able to fail, not of the editor that happens to render them.
 */
export function bootErrors(): ErrorsModule {
  const reporters: ErrorReporter[] = [new ConsoleErrorReporter()];
  return {
    workerErrorMonitor: new WorkerErrorMonitor(new CompositeErrorReporter(reporters)),
    errorClassifier: new AppErrorClassifier(),
    errorTelemetryDescriber: new AppErrorTelemetryDescriber(),
    appNoticeChannel: new AppNoticeChannel(),
    failureReasonResolver: new FailureReasonResolver([
      new StorageFullFailureReasonRule(),
      new UnsupportedCodecFailureReasonRule(),
      new BackendUnavailableFailureReasonRule(),
    ]),
  };
}
