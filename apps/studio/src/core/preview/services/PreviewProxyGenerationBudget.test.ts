import { describe, expect, it } from 'vitest';
import { PreviewProxyGenerationBudget } from '@core/preview/services/PreviewProxyGenerationBudget';

/**
 * The two anchors are the decision; the rest of the curve only has to
 * pass through them and stay between them. The invariant worth
 * protecting is that a longer source gets a longer wait.
 */

const budget = new PreviewProxyGenerationBudget();

describe('the anchors', () => {

  it('grants twenty seconds to a minute of video', () => {
    expect(budget.forDuration(60)).toBe(20);
  });

  it('grants ninety seconds to ten minutes of video', () => {
    expect(budget.forDuration(600)).toBe(90);
  });
});

describe('outside the anchors', () => {

  it('clamps a very short source to the floor rather than below it', () => {
    expect(budget.forDuration(3)).toBe(20);
  });

  it('clamps an hour to the ceiling rather than above it', () => {
    expect(budget.forDuration(3600)).toBe(90);
  });

  it('budgets an unknown duration as a short source', () => {
    expect(budget.forDuration(null)).toBe(20);
  });
});

describe('between the anchors', () => {

  it('grants more time to a longer source', () => {
    expect(budget.forDuration(300)).toBeGreaterThan(budget.forDuration(120));
  });

  it('stays within the anchors', () => {
    const midpoint = budget.forDuration(330);
    expect(midpoint).toBeGreaterThan(20);
    expect(midpoint).toBeLessThan(90);
  });

  // The absolute wait grows and the share of the video it costs shrinks.
  // Both are deliberate, and the second is the one a reader feels as
  // "this is taking forever" on a short clip.
  it('spends a smaller share of a long source than of a short one', () => {
    expect(budget.forDuration(600) / 600).toBeLessThan(budget.forDuration(60) / 60);
  });
});
