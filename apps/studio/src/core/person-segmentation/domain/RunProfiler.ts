/**
 * Wall-clock accounting for one detector run, broken down by the step
 * that spent the time.
 *
 * A run is opened with `begin` and closed with `report`. Runs may
 * overlap — a mask backfill can start while a background pass is
 * mid-chunk — and an implementation is expected to survive that
 * rather than lose either one's numbers.
 *
 * The contract exists so the detector's path can be measured without
 * the measuring being a condition of it working: an implementation
 * that records nothing is a complete implementation.
 */
export interface RunProfiler {
  begin(): void;

  /** Times `work` under `step` and passes its result through, whether it resolves or throws. */
  measure<T>(step: string, work: () => Promise<T>): Promise<T>;

  /** Synchronous {@link measure}, for steps that never await. */
  measureSync<T>(step: string, work: () => T): T;

  /** Closes a run opened by `begin`. `context` describes the run for whoever reads the numbers. */
  report(context: string): void;
}
