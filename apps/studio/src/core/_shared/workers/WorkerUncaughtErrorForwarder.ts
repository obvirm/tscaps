import {
  WORKER_UNCAUGHT_ERROR_MESSAGE_TYPE,
  type WorkerUncaughtErrorMessage,
} from '@core/_shared/workers/WorkerUncaughtErrorMessage';

/**
 * Installs the worker's global failure handlers, keeping the console
 * output visible and forwarding unhandled promise rejections to the
 * main thread.
 *
 * Only rejections are forwarded. An uncaught `error` propagates to the
 * owner's own `error` event on its own, so forwarding it too would
 * report the same failure twice; cancelling the event to suppress that
 * is not an option either, since the owners depend on it to reject
 * whatever request was in flight. A rejection has no such path — it
 * never leaves the worker — which is why it needs this channel.
 *
 * Install once, as the first statement of a worker entry script.
 */
export class WorkerUncaughtErrorForwarder {

  constructor(private readonly workerName: string) {}

  install(): void {
    self.addEventListener('error', (event: ErrorEvent) => {
      console.error(
        `[${this.workerName}] uncaught error`,
        event.message,
        `${event.filename}:${event.lineno}`,
        event.error,
      );
    });
    self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      console.error(`[${this.workerName}] unhandled rejection`, event.reason);
      this.forward(event.reason);
    });
  }

  private forward(reason: unknown): void {
    const message: WorkerUncaughtErrorMessage = {
      type: WORKER_UNCAUGHT_ERROR_MESSAGE_TYPE,
      ...this.describe(reason),
    };
    (self as unknown as Worker).postMessage(message);
  }

  private describe(reason: unknown): {
    errorName: string;
    errorMessage: string;
    errorStack: string | null;
  } {
    if (reason instanceof Error) {
      return {
        errorName: reason.name,
        errorMessage: reason.message,
        errorStack: reason.stack ?? null,
      };
    }
    return {
      errorName: 'WorkerUnhandledRejection',
      errorMessage: `Unhandled promise rejection in worker: ${String(reason)}`,
      errorStack: null,
    };
  }
}
