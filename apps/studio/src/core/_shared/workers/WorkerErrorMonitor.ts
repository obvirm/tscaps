import type { ErrorReporter } from '@core/errors/domain/ErrorReporter';
import {
  WORKER_UNCAUGHT_ERROR_MESSAGE_TYPE,
  type WorkerUncaughtErrorMessage,
} from '@core/_shared/workers/WorkerUncaughtErrorMessage';

/**
 * Watches a worker for failures nobody else is waiting on and hands
 * them to the reporter: a crash or a script that fails to load, a
 * message that cannot be deserialised, and the rejections the worker
 * forwards by hand.
 *
 * Listeners are added, never assigned, so an owner's own `onerror` /
 * `onmessage` handling keeps working untouched. Monitoring is purely
 * observational: it swallows nothing and rejects nothing, leaving the
 * owner in charge of how a failure affects its in-flight work.
 */
export class WorkerErrorMonitor {

  constructor(private readonly errorReporter: ErrorReporter) {}

  monitor(worker: Worker, workerName: string): void {
    worker.addEventListener('error', (event: ErrorEvent) => {
      this.errorReporter.report(this.fromErrorEvent(event), workerName);
    });
    worker.addEventListener('messageerror', () => {
      this.errorReporter.report(
        new Error('A worker message failed to deserialize.'),
        workerName,
      );
    });
    worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      const forwarded = this.readUncaughtError(event.data);
      if (!forwarded) return;
      this.errorReporter.report(this.fromForwardedMessage(forwarded), workerName);
    });
  }

  private fromErrorEvent(event: ErrorEvent): Error {
    if (event.error instanceof Error) return event.error;
    return new Error(event.message || 'Worker crashed or failed to load.');
  }

  private fromForwardedMessage(forwarded: WorkerUncaughtErrorMessage): Error {
    const error = new Error(forwarded.errorMessage);
    error.name = forwarded.errorName;
    if (forwarded.errorStack) error.stack = forwarded.errorStack;
    return error;
  }

  private readUncaughtError(data: unknown): WorkerUncaughtErrorMessage | null {
    if (typeof data !== 'object' || data === null) return null;
    const candidate = data as Partial<WorkerUncaughtErrorMessage>;
    if (candidate.type !== WORKER_UNCAUGHT_ERROR_MESSAGE_TYPE) return null;
    return candidate as WorkerUncaughtErrorMessage;
  }
}
