import type { AppError } from '@core/errors/domain/AppError';
import type { TelemetryEventProperties } from '@shared/telemetry';

const MAX_DEPTH = 8;
const MAX_MESSAGE_CHARS = 500;
const CHAIN_SEPARATOR = ' -> ';

/**
 * Turns an `AppError` into the property bag every telemetry site uses
 * to describe a failure.
 *
 * The outer name/message and the immediate cause pair travel as
 * separate fields — they carry the primary groupings dashboards
 * already filter on. `error_chain` joins every link of the cause
 * chain as `Name: message` fragments, so a failure whose real reason
 * is nested several wrappers deep still tells its full story from a
 * single event without adding a field per level.
 *
 * The walk is capped at MAX_DEPTH links and guards against a cause
 * that points back into the chain; each message is truncated at
 * MAX_MESSAGE_CHARS. Together those keep the joined field well within
 * the per-property size caps telemetry backends enforce even under
 * pathological chains.
 */
export class AppErrorTelemetryDescriber {
  describe(appError: AppError): TelemetryEventProperties {
    const chain = this.walk(appError);
    const cause = chain[1] ?? null;
    return {
      error_name: appError.name,
      error_message: appError.message,
      error_cause_name: cause ? cause.name : null,
      error_cause_message: cause ? cause.message : null,
      error_chain: chain.map((link) => this.formatLink(link)).join(CHAIN_SEPARATOR),
    };
  }

  private walk(outer: Error): Error[] {
    const chain: Error[] = [];
    const seen = new Set<Error>();
    let current: unknown = outer;
    while (current instanceof Error && !seen.has(current) && chain.length < MAX_DEPTH) {
      chain.push(current);
      seen.add(current);
      current = (current as { cause?: unknown }).cause;
    }
    return chain;
  }

  private formatLink(error: Error): string {
    const message = error.message.length > MAX_MESSAGE_CHARS
      ? error.message.slice(0, MAX_MESSAGE_CHARS) + '...'
      : error.message;
    return `${error.name}: ${message}`;
  }
}
