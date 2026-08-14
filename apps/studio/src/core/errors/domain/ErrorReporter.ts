/**
 * Sink for errors that no user-facing flow will surface on its own —
 * a crash with no request waiting on it, a background task that dies
 * silently. Implementations are best-effort: `report` never throws and
 * never blocks the caller.
 *
 * `origin` names the component the error came from and travels with
 * the report as technical context. It is a fixed identifier, never a
 * user-authored string.
 */
export interface ErrorReporter {
  report(error: Error, origin: string): void;
}
