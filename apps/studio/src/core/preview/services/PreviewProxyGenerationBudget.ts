/**
 * How long to wait for a preview proxy before giving up and playing
 * the source.
 *
 * Scales with the source's duration: what giving up costs grows with
 * it, so a longer video earns a longer wait. Anchored at 20 s for a
 * minute of video and 90 s for ten, interpolated between and clamped
 * outside.
 *
 * Both anchors are product judgement, not measurement. Changing them
 * wants `proxy_generation_ms` telemetry behind it.
 */
export class PreviewProxyGenerationBudget {

  private static readonly SHORT_SOURCE_SEC = 60;
  private static readonly SHORT_SOURCE_BUDGET_SEC = 20;
  private static readonly LONG_SOURCE_SEC = 10 * 60;
  private static readonly LONG_SOURCE_BUDGET_SEC = 90;

  /**
   * Seconds worth waiting for a source of `durationSeconds`. An
   * unknown duration gets the floor — generation stays available on
   * demand, so the cheap guess is the recoverable one.
   */
  forDuration(durationSeconds: number | null): number {
    if (durationSeconds === null) return PreviewProxyGenerationBudget.SHORT_SOURCE_BUDGET_SEC;
    return this.interpolate(durationSeconds);
  }

  private interpolate(durationSeconds: number): number {
    const { SHORT_SOURCE_SEC, LONG_SOURCE_SEC, SHORT_SOURCE_BUDGET_SEC, LONG_SOURCE_BUDGET_SEC } =
      PreviewProxyGenerationBudget;
    const position = (durationSeconds - SHORT_SOURCE_SEC) / (LONG_SOURCE_SEC - SHORT_SOURCE_SEC);
    const clamped = Math.min(1, Math.max(0, position));
    return SHORT_SOURCE_BUDGET_SEC + clamped * (LONG_SOURCE_BUDGET_SEC - SHORT_SOURCE_BUDGET_SEC);
  }
}
