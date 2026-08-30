const FIXTURE_CLASS = 'tscaps-subtree-animation-support-probe';
const FIXTURE_ANIMATION = 'tscaps-subtree-animation-support';
const FIXTURE_CSS = `
  .${FIXTURE_CLASS}::before { content: ""; animation: ${FIXTURE_ANIMATION} 1s linear both; }
  @keyframes ${FIXTURE_ANIMATION} { from { opacity: 0 } to { opacity: 1 } }
`;
const FIXTURE_STYLES = 'position:fixed;left:-99999px;visibility:hidden;pointer-events:none;';

/**
 * Whether the browser can be asked what animations a subtree runs.
 *
 * Answered by mounting a fixture rather than by naming versions: the
 * question needs `getAnimations` to exist, to honour the `subtree`
 * option, and to report an effect that lives on a descendant's
 * pseudo-element. One fixture exercises all three.
 *
 * Checked on first use and remembered for the lifetime of the
 * instance.
 */
export class SubtreeAnimationSupport {
  private available: boolean | null = null;

  isAvailable(): boolean {
    if (this.available === null) this.available = this.check();
    return this.available;
  }

  private check(): boolean {
    const root = document.createElement('div');
    if (typeof root.getAnimations !== 'function') return false;

    root.style.cssText = FIXTURE_STYLES;
    const descendant = document.createElement('div');
    descendant.className = FIXTURE_CLASS;
    root.appendChild(descendant);

    const styleElement = document.createElement('style');
    styleElement.textContent = FIXTURE_CSS;
    document.head.appendChild(styleElement);
    document.body.appendChild(root);
    try {
      return root.getAnimations({ subtree: true }).length > 0;
    } catch {
      // A browser that rejects the options argument outright cannot be
      // asked the question at all, which is the same answer as one
      // that returns nothing for it.
      return false;
    } finally {
      root.remove();
      styleElement.remove();
    }
  }
}
