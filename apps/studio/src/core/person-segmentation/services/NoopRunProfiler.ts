import type { RunProfiler } from '@core/person-segmentation/domain/RunProfiler';

/**
 * {@link RunProfiler} that records nothing and reports nothing — the
 * detector's normal state.
 *
 * Measuring the run costs a timestamp pair per sampled frame and a
 * multi-line report per chunk, and the background pass works through a
 * chunk every few seconds for as long as the editor is open. That is
 * worth paying while someone is reading the numbers and worth nothing
 * otherwise.
 */
export class NoopRunProfiler implements RunProfiler {

  begin(): void {}

  measure<T>(_step: string, work: () => Promise<T>): Promise<T> {
    return work();
  }

  measureSync<T>(_step: string, work: () => T): T {
    return work();
  }

  report(_context: string): void {}
}
