import type { RunProfiler } from '@core/person-segmentation/domain/RunProfiler';

interface StepTotals {
  calls: number;
  ms: number;
}

/**
 * {@link RunProfiler} that prints its breakdown to the console.
 *
 * Every call is summed rather than sampled, so the report covers the
 * run end to end and the steps add up to it. It is printed once, on
 * `report`, as a single block: a run works through a chunk at a time
 * for as long as the editor is open, and per-step lines would drown
 * everything else.
 *
 * Runs that overlap fold into one report rather than cutting each
 * other short — the outermost `report` prints, and the contexts of the
 * runs that closed inside it are listed alongside its own. The
 * alternative is a nested run clearing the totals of the one it
 * started inside, which loses both.
 */
export class ConsoleRunProfiler implements RunProfiler {
  private readonly totalsByStep = new Map<string, StepTotals>();
  private readonly contextsClosedInside: string[] = [];
  private openRuns = 0;
  private startedAtMs = 0;

  begin(): void {
    if (this.openRuns === 0) {
      this.totalsByStep.clear();
      this.contextsClosedInside.length = 0;
      this.startedAtMs = performance.now();
    }
    this.openRuns++;
  }

  async measure<T>(step: string, work: () => Promise<T>): Promise<T> {
    const startedAtMs = performance.now();
    try {
      return await work();
    } finally {
      this.record(step, performance.now() - startedAtMs);
    }
  }

  measureSync<T>(step: string, work: () => T): T {
    const startedAtMs = performance.now();
    try {
      return work();
    } finally {
      this.record(step, performance.now() - startedAtMs);
    }
  }

  report(context: string): void {
    if (this.openRuns === 0) return;
    this.openRuns--;
    if (this.openRuns > 0) {
      this.contextsClosedInside.push(context);
      return;
    }
    console.log(this.breakdown(context));
  }

  private breakdown(context: string): string {
    const elapsedMs = performance.now() - this.startedAtMs;
    const steps = [...this.totalsByStep.entries()]
      .sort(([, a], [, b]) => b.ms - a.ms)
      .map(([step, totals]) => this.formatStep(step, totals, elapsedMs));
    const accountedMs = [...this.totalsByStep.values()].reduce((total, step) => total + step.ms, 0);
    return [
      `[person-segmentation] run finished in ${this.seconds(elapsedMs)} s — ${context}`,
      ...this.contextsClosedInside.map((closed) => `  alongside — ${closed}`),
      ...steps,
      this.formatUnaccounted(elapsedMs - accountedMs, elapsedMs),
    ].join('\n');
  }

  private formatStep(step: string, totals: StepTotals, elapsedMs: number): string {
    const share = elapsedMs > 0 ? (totals.ms / elapsedMs) * 100 : 0;
    const mean = totals.calls > 0 ? totals.ms / totals.calls : 0;
    return `  ${step.padEnd(22)} ${this.seconds(totals.ms).padStart(8)} s  ${share.toFixed(1).padStart(5)}%`
      + `  ${String(totals.calls).padStart(6)} calls  ${mean.toFixed(1).padStart(7)} ms/call`;
  }

  private formatUnaccounted(unaccountedMs: number, elapsedMs: number): string {
    const share = elapsedMs > 0 ? (unaccountedMs / elapsedMs) * 100 : 0;
    return `  ${'(unmeasured)'.padEnd(22)} ${this.seconds(unaccountedMs).padStart(8)} s  ${share.toFixed(1).padStart(5)}%`;
  }

  private seconds(ms: number): string {
    return (ms / 1000).toFixed(2);
  }

  private record(step: string, ms: number): void {
    const totals = this.totalsByStep.get(step);
    if (totals === undefined) {
      this.totalsByStep.set(step, { calls: 1, ms });
      return;
    }
    totals.calls++;
    totals.ms += ms;
  }
}
