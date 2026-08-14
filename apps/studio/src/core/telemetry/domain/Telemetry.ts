import type { Telemetry as GenericTelemetry } from '@shared/telemetry';
import type { TelemetryEventName } from '@core/telemetry/domain/TelemetryEventName';

/**
 * Studio's telemetry port. Pins the shared generic contract to the
 * editor's event-name union so call sites are typo-checked at
 * compile time.
 */
export type Telemetry = GenericTelemetry<TelemetryEventName>;
