import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';

const SEPARATOR = '\n\n';
const LEADING_BLANK_LINES = /^\n+/;

/**
 * Moves one animation's block inside CSS this code generated.
 *
 * An animation is a set of declarations plus its keyframes, so swapping
 * one means taking the last one out whole. It is found the only way
 * that has an answer: the record says which animation was there, so the
 * block that record would build is the block to look for. Nothing here
 * reads CSS to work out what it means.
 *
 * A block goes first, so anything written after it wins — the same
 * order the fields keep. An element holding one animation per part of
 * itself therefore carries a block per part, and each is found on its
 * own: two of them can never read the same, because each carries the
 * selector and the clock its scope resolves to.
 */
export class ElementAnimationCssWriter {
  constructor(private readonly animationCssBuilder: ElementAnimationCssBuilder) {}

  /**
   * The element's CSS with the block `previous` wrote for this scope
   * swapped for the one `next` writes.
   *
   * Returns the CSS untouched once that block has been taken over: an
   * animation picked from a list never overwrites one somebody wrote.
   * Pass `previous` as `undefined` for a scope that never had one, and
   * `next` as `undefined` to take the block out.
   */
  rewrite(
    css: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    previous: ElementAnimation | undefined,
    next: ElementAnimation | undefined,
  ): string {
    const arriving = next ? this.animationCssBuilder.build(next, kind, scope) : '';
    if (previous === undefined) return this.prepended(css, arriving);
    if (this.isTakenOver(css, kind, scope, previous)) return css;
    return this.swapped(css, this.animationCssBuilder.build(previous, kind, scope), arriving);
  }

  /**
   * Whether the CSS has stopped being the one this animation wrote —
   * edited in place, deleted, or left behind by an animation the
   * library no longer offers.
   *
   * The question is asked the same way a field asks it: the record knows
   * exactly what it would write, so it looks for that and nothing else.
   */
  isTakenOver(
    css: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    animation: ElementAnimation,
  ): boolean {
    const written = this.animationCssBuilder.build(animation, kind, scope);
    return written.length === 0 || !css.includes(written);
  }

  private prepended(css: string, arriving: string): string {
    if (arriving.length === 0) return css;
    return css.trim().length > 0 ? `${arriving}${SEPARATOR}${css}` : arriving;
  }

  private swapped(css: string, leaving: string, arriving: string): string {
    const at = css.indexOf(leaving);
    const before = css.slice(0, at);
    const after = css.slice(at + leaving.length);
    if (arriving.length > 0) return `${before}${arriving}${after}`;
    return `${before}${after.replace(LEADING_BLANK_LINES, '')}`.trimStart();
  }
}
