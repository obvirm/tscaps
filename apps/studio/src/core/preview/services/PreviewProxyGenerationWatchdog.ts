/**
 * Aborts a proxy generation that outruns its budget.
 *
 * Two triggers. The deadline fires at the budget whatever the encoder
 * is doing, so a run that stops reporting progress is still bounded.
 * The projection is an early exit only: once the rate is known, a run
 * certain to overrun is dropped without running the clock down.
 * Correctness rests on the deadline alone — a wrong projection costs
 * wait time, never the guarantee.
 *
 * Rate is measured from the first progress report, not from
 * construction: startup (opening the file, starting a decoder) is paid
 * once and would otherwise be counted as encoding, making healthy runs
 * look doomed.
 */
export class PreviewProxyGenerationWatchdog {

  /** How long the rate is left to settle before the projection is believed. */
  private static readonly PROBE_WINDOW_MS = 5_000;

  private readonly controller = new AbortController();
  private readonly startedAtMs = Date.now();
  private readonly timer: ReturnType<typeof setTimeout>;
  private firstReportAtMs: number | null = null;
  private firstReportProgress = 0;

  constructor(private readonly budgetSeconds: number) {
    this.timer = setTimeout(() => this.controller.abort(), budgetSeconds * 1000);
  }

  /** Fires when the run should stop. Hand it to the generator. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** True once this watchdog is what ended the run, rather than the run ending on its own. */
  get abandoned(): boolean {
    return this.controller.signal.aborted;
  }

  /**
   * Feeds one progress report in `[0, 1]`. Safe to call at any rate,
   * including not at all — a run that reports nothing is bounded by
   * the deadline alone.
   */
  observe(progress: number): void {
    const now = Date.now();
    if (this.firstReportAtMs === null) {
      this.firstReportAtMs = now;
      this.firstReportProgress = progress;
      return;
    }
    if (now - this.firstReportAtMs < PreviewProxyGenerationWatchdog.PROBE_WINDOW_MS) return;
    if (this.projectedTotalSeconds(now, progress) > this.budgetSeconds) this.controller.abort();
  }

  /** Stops the deadline. Leaves `abandoned` reading whatever it already read. */
  dispose(): void {
    clearTimeout(this.timer);
  }

  /**
   * Projected total run time, counted from construction so it is
   * comparable to the budget. `Infinity` when progress has not moved
   * since the first report — a stall is indistinguishable from an
   * unusably slow encode, and both should be abandoned.
   */
  private projectedTotalSeconds(now: number, progress: number): number {
    const madeSinceFirst = progress - this.firstReportProgress;
    if (madeSinceFirst <= 0) return Number.POSITIVE_INFINITY;
    const elapsedSinceFirstMs = now - this.firstReportAtMs!;
    const remainingMs = ((1 - progress) / madeSinceFirst) * elapsedSinceFirstMs;
    return (now - this.startedAtMs + remainingMs) / 1000;
  }
}
