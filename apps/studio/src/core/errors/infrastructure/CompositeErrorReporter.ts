import type { ErrorReporter } from '@core/errors/domain/ErrorReporter';

/**
 * Fans a report out to several reporters in order. One reporter
 * throwing does not stop the rest, and nothing escapes to the caller:
 * a failure to report an error must never itself become an error.
 */
export class CompositeErrorReporter implements ErrorReporter {

  constructor(private readonly reporters: ReadonlyArray<ErrorReporter>) {}

  report(error: Error, origin: string): void {
    for (const reporter of this.reporters) {
      try {
        reporter.report(error, origin);
      } catch {
        // A broken reporting channel is not worth surfacing anywhere:
        // the console reporter in the chain already has the error.
      }
    }
  }
}
