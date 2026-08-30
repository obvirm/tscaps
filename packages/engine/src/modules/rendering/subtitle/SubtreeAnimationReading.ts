/** One effect the browser reported, timed against the playhead it was read at. */
export interface TimedEffect {
  readonly address: string;
  readonly rule: string;
  /** When the effect's active phase opens, relative to the playhead. */
  readonly startsInMs: number;
  /** How long that phase lasts, or `null` where the effect repeats forever. */
  readonly activeDurationMs: number | null;
}

// A clock reaches the stylesheet as a `<time>` rounded to milliseconds,
// so the same effect read at two playheads can report delays that
// disagree by a whole millisecond without either being wrong.
const CLOCK_QUANTUM_MS = 1;

/**
 * What the browser reported about one mounted subtree, and what that
 * still decides at other playheads.
 *
 * A frozen frame anchors every effect's timeline to the playhead
 * through a negative delay, so advancing the playhead by Δ is expected
 * to move each phase boundary by −Δ. A stylesheet doing arithmetic on
 * a clock breaks that, which {@link predicts} is there to catch.
 *
 * A reading answers only where being wrong about the shift could not
 * change the answer: the playhead has to sit farther from every
 * boundary than the distance travelled since the reading was taken.
 */
export class SubtreeAnimationReading {

  constructor(
    private readonly effects: ReadonlyArray<TimedEffect>,
    private readonly takenAtSeconds: number,
  ) {}

  /**
   * Whether this reading decides the question at `seconds` on its own.
   * `false` means the subtree has to be read again there.
   */
  answersAt(seconds: number): boolean {
    const travelledMs = Math.abs(this.elapsedMsTo(seconds));
    const safeDistanceMs = Math.max(travelledMs, CLOCK_QUANTUM_MS * 2);
    return this.effects.every((effect) => {
      // An effect that repeats forever answers the same at every
      // playhead, so no distance protects anything.
      if (effect.activeDurationMs === null) return true;
      return this.distanceToBoundariesMs(effect, seconds) > safeDistanceMs;
    });
  }

  /**
   * A value equal for two playheads exactly when every effect holds the
   * same fixed value at both, or `null` where one of them is mid-run or
   * repeats forever.
   */
  phaseKeyAt(seconds: number): string | null {
    const elapsedMs = this.elapsedMsTo(seconds);
    const phases: string[] = [];
    for (const effect of this.effects) {
      if (effect.activeDurationMs === null) return null;
      const startsInMs = effect.startsInMs - elapsedMs;
      if (startsInMs <= 0 && startsInMs + effect.activeDurationMs > 0) return null;
      phases.push(`${effect.address}:${effect.rule}:${startsInMs > 0 ? 'before' : 'after'}`);
    }
    phases.sort();
    return JSON.stringify(phases);
  }

  /**
   * Whether `later` is what this reading said would be found there:
   * the same effects, each shifted by exactly the elapsed time. A
   * mismatch means the subtree's timing does not follow the playhead,
   * and nothing may be carried across playheads for it.
   */
  predicts(later: SubtreeAnimationReading): boolean {
    if (later.effects.length !== this.effects.length) return false;
    const elapsedMs = this.elapsedMsTo(later.takenAtSeconds);
    return this.effects.every((effect, index) => {
      const found = later.effects[index]!;
      return found.address === effect.address
        && found.rule === effect.rule
        && found.activeDurationMs === effect.activeDurationMs
        && Math.abs(found.startsInMs - (effect.startsInMs - elapsedMs)) <= CLOCK_QUANTUM_MS;
    });
  }

  private elapsedMsTo(seconds: number): number {
    return (seconds - this.takenAtSeconds) * 1000;
  }

  /** How far the playhead at `seconds` sits from the nearer end of the effect's active phase. */
  private distanceToBoundariesMs(effect: TimedEffect, seconds: number): number {
    const startsInMs = effect.startsInMs - this.elapsedMsTo(seconds);
    const endsInMs = startsInMs + (effect.activeDurationMs ?? 0);
    return Math.min(Math.abs(startsInMs), Math.abs(endsInMs));
  }
}
