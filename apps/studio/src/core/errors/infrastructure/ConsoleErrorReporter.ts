import type { ErrorReporter } from '@core/errors/domain/ErrorReporter';

/**
 * Writes reports to the console and nowhere else. The default when no
 * reporting backend is configured: a developer running the app still
 * sees the failure, and nothing leaves the browser.
 */
export class ConsoleErrorReporter implements ErrorReporter {

  report(error: Error, origin: string): void {
    console.error(`[${origin}] uncaught error`, error);
  }
}
