import type { ElementCssContext } from '@core/elements/domain/ElementCssContext';
import type { ElementCssProblem } from '@core/elements/domain/ElementCssProblem';
import type { ElementCssRule } from '@core/elements/domain/ElementCssRule';

const ANIMATION_DECLARATION = /(?:^|[;{}\s])animation(?:-name)?\s*:([^;{}]*)/g;
const PLAYHEAD_VARIABLE_REFERENCE = /var\(\s*--on-/;

/**
 * Flags an animation with nothing tying it to the playhead.
 *
 * Animations here never run on their own: every one of them is paused,
 * and the frame on screen is whichever one the delay lands on. A delay
 * that is a constant therefore picks one frame and holds it forever, so
 * an animation without a `--on-…` variable in it is not a slow animation
 * or a broken one — it is a still image, and it looks exactly like CSS
 * that was ignored.
 *
 * An element that turns animation off has no frame to hold, so saying
 * nothing is the whole of the advice there.
 */
export class PlayheadAnchoredAnimationElementCssRule implements ElementCssRule {
  check(minifiedCss: string, context: ElementCssContext): ElementCssProblem[] {
    if (!this.animatesAnything(minifiedCss)) return [];
    if (PLAYHEAD_VARIABLE_REFERENCE.test(minifiedCss)) return [];
    return [{
      message: `This animation has no delay tied to the playhead, so it will hold its first frame. Use var(${context.timingVariable}) as the animation's delay.`,
    }];
  }

  private animatesAnything(minifiedCss: string): boolean {
    const values = [...minifiedCss.matchAll(ANIMATION_DECLARATION)].map((match) => match[1]!.trim());
    return values.some((value) => value.toLowerCase() !== 'none');
  }
}
