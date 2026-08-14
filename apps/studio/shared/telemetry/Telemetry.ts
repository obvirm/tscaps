/**
 * Sends product-analytics events to the configured backend.
 *
 * Implementations are best-effort: a network error, a missing
 * environment variable, or a backend outage must never block the
 * caller — the contract is fire-and-forget. Implementations also
 * handle batching, retry, and identifier strategy internally.
 *
 * `EventName` is generic so each consumer app can pin the port to
 * its own string union and get typo-checked event names at compile
 * time. Properties are flat scalars (or arrays of scalars); nested
 * objects are intentionally not supported because they make
 * per-property querying in the backend awkward.
 */
export interface Telemetry<EventName extends string = string> {
  capture(event: EventName, properties?: TelemetryEventProperties): void;
}

/**
 * Free-form bag of properties travelling alongside a telemetry
 * event. Values are scalar or array-of-scalar — telemetry backends
 * serialize properties as JSON and nested objects are discouraged
 * because they make per-property querying awkward.
 */
export type TelemetryEventProperties = Record<string, TelemetryEventPropertyValue>;

export type TelemetryEventPropertyValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | readonly number[];
