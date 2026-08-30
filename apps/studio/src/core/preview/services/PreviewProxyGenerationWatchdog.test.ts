import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewProxyGenerationWatchdog } from '@core/preview/services/PreviewProxyGenerationWatchdog';

/**
 * The deadline is the guarantee and the projection is an optimisation
 * over it, so they are tested apart.
 *
 * Fake timers throughout: the class reads the wall clock.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the deadline', () => {

  it('abandons a run that never reports progress at all', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(20);
    vi.advanceTimersByTime(20_000);
    expect(watchdog.abandoned).toBe(true);
  });

  it('leaves a run alone before its budget is spent', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(20);
    vi.advanceTimersByTime(19_000);
    expect(watchdog.abandoned).toBe(false);
  });

  it('stops running once disposed', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(20);
    watchdog.dispose();
    vi.advanceTimersByTime(60_000);
    expect(watchdog.abandoned).toBe(false);
  });
});

describe('the projection', () => {

  it('abandons a run that will overrun, without waiting for the deadline', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(20);
    watchdog.observe(0);
    // 2% in six seconds projects to about five minutes.
    vi.advanceTimersByTime(6_000);
    watchdog.observe(0.02);
    expect(watchdog.abandoned).toBe(true);
  });

  it('leaves a run that will finish inside the budget', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(20);
    watchdog.observe(0);
    // Half of it in six seconds projects to twelve.
    vi.advanceTimersByTime(6_000);
    watchdog.observe(0.5);
    expect(watchdog.abandoned).toBe(false);
  });

  it('waits for the rate to settle before believing it', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(20);
    watchdog.observe(0);
    // The same hopeless rate as above, reported too early to trust.
    vi.advanceTimersByTime(1_000);
    watchdog.observe(0.003);
    expect(watchdog.abandoned).toBe(false);
  });

  // The numbers matter: they are picked so the two readings disagree on
  // the verdict, not just on the figure. 9 s of startup then 60% in 6 s
  // projects to 19 s from the first report (survives a 20 s budget) and
  // to 25 s from construction (abandoned). Change them and this stops
  // testing anything.
  it('measures the rate from the first report, not from the start of the run', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(20);
    vi.advanceTimersByTime(9_000);
    watchdog.observe(0);
    vi.advanceTimersByTime(6_000);
    watchdog.observe(0.6);
    expect(watchdog.abandoned).toBe(false);
  });

  it('abandons a run whose progress has stopped moving', () => {
    const watchdog = new PreviewProxyGenerationWatchdog(60);
    watchdog.observe(0.3);
    vi.advanceTimersByTime(6_000);
    watchdog.observe(0.3);
    expect(watchdog.abandoned).toBe(true);
  });
});
