/** One reading on a row's ruler. */
export interface TimelineRulerTick {
  readonly timeSec: number;
  /** Where it sits across the row, 0..1. */
  readonly fraction: number;
  readonly label: string;
}

/**
 * Steps a reader can count in. Time is not decimal past the minute, so
 * the ladder follows the clock — 15s, 30s, a minute, two — rather than
 * powers of ten.
 *
 * Every entry is a whole number of seconds or sits on the 0.05 grid, and
 * that is load-bearing: it is what makes a mark's seconds always round
 * *down* within its own minute, so the reading below can split minutes
 * from seconds without a mark ever coming out as `0:60`. A step off this
 * grid — 0.3, say — breaks that and needs the reading rewritten.
 */
const STEPS_SEC: ReadonlyArray<number> = [
  0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600,
];

/**
 * How many gaps between readings a row aims for. The ladder is coarser
 * than this target, so the real count lands somewhere under it.
 */
const TARGET_INTERVALS = 6;

/**
 * Where a row's ruler is marked, and what each mark reads.
 *
 * Marks land on **absolute** multiples of the step, never on offsets
 * from where the row happens to begin: rows are cut at whatever duration
 * the zoom picked, so an offset ruler would read in numbers nobody can
 * navigate by. The cost is that a row's own first instant is usually
 * unmarked, which the row's position in the stack already tells anyone
 * reading it.
 *
 * The step is chosen from the row's own duration, so the last row —
 * shorter than the rest but drawn to the same width — is marked at the
 * spacing it is actually drawn at.
 */
export class TimelineRulerTicks {

  resolve(rowStartSec: number, rowDurationSec: number): ReadonlyArray<TimelineRulerTick> {
    const stepSec = this.stepFor(rowDurationSec);
    const endSec = rowStartSec + rowDurationSec;
    const ticks: TimelineRulerTick[] = [];
    for (let index = Math.ceil(rowStartSec / stepSec); index * stepSec < endSec; index++) {
      const timeSec = index * stepSec;
      ticks.push({
        timeSec,
        fraction: (timeSec - rowStartSec) / rowDurationSec,
        label: this.label(timeSec, stepSec),
      });
    }
    return ticks;
  }

  private stepFor(rowDurationSec: number): number {
    const targetSec = rowDurationSec / TARGET_INTERVALS;
    const fromLadder = STEPS_SEC.find((step) => step >= targetSec);
    if (fromLadder !== undefined) return fromLadder;
    // Past the ladder's reach a row covers hours. Whole multiples of its
    // last step keep the readings on round minutes.
    const longestSec = STEPS_SEC[STEPS_SEC.length - 1]!;
    return Math.ceil(targetSec / longestSec) * longestSec;
  }

  /**
   * Precision follows the step: a ruler marked every two seconds has no
   * business claiming tenths, and one marked every tenth is unreadable
   * without them.
   */
  private label(timeSec: number, stepSec: number): string {
    const decimals = this.decimalsFor(stepSec);
    const minutes = Math.floor(timeSec / 60);
    const seconds = timeSec - minutes * 60;
    const width = decimals > 0 ? decimals + 3 : 2;
    return `${minutes}:${seconds.toFixed(decimals).padStart(width, '0')}`;
  }

  private decimalsFor(stepSec: number): number {
    if (stepSec >= 1) return 0;
    return stepSec >= 0.1 ? 1 : 2;
  }
}
