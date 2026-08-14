import {
  ANIMATED_KIND_BY_SCOPE,
  ELEMENT_ANIMATION_SCOPES,
  type ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import { StoredElementAnimation } from '@core/elements/domain/StoredElementAnimation';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { SheetAnimation, TunedPropertyValues } from '@core/sheets/domain/SheetAnimation';

const SEPARATOR = '\n\n';

/** Plain shape for serialization. Only the kinds the sheet answered for are present. */
export type SheetAnimationSetSnapshot = Readonly<Partial<Record<ElementAnimationScope, SheetAnimation>>>;

/**
 * How everything under one sheet moves, by the kind of element the
 * answer was given to.
 *
 * At most one answer per kind, which is what keeps the two ways of
 * answering from meeting: they write the same custom properties into
 * the same layer, and a kind that could hold both would need a rule
 * elsewhere deciding which one renders.
 *
 * Each kind carries its own text, so answering for the words leaves
 * the block the captions were given exactly as it was compiled.
 *
 * There is no swapping to do inside these texts. An element mixes its
 * animations with its fields and with whatever was typed beside them,
 * which is what makes taking one out surgery; here each block is a
 * field of its own and replacing one is replacing a value.
 *
 * `self` is not storable: it means "the element itself" and a sheet is
 * not one. A stored entry against it is dropped rather than kept as a
 * scope that could never render.
 */
export class SheetAnimationSet {

  private constructor(private readonly byScope: ReadonlyMap<ElementAnimationScope, SheetAnimation>) {}

  static empty(): SheetAnimationSet {
    return new SheetAnimationSet(new Map());
  }

  /**
   * The stored answers, minus any this build cannot render: a scope it
   * does not offer, a record that does not hold, or a block that never
   * made it to text. Each one dropped leaves that kind on the
   * template's, which is where it was before anyone answered.
   */
  static fromSnapshot(value: unknown): SheetAnimationSet {
    if (value === null || typeof value !== 'object') return SheetAnimationSet.empty();
    const byScope = new Map<ElementAnimationScope, SheetAnimation>();
    for (const scope of ELEMENT_ANIMATION_SCOPES) {
      if (ANIMATED_KIND_BY_SCOPE[scope] === null) continue;
      const read = SheetAnimationSet.readOne((value as Record<string, unknown>)[scope]);
      if (read !== undefined) byScope.set(scope, read);
    }
    return new SheetAnimationSet(byScope);
  }

  private static readOne(value: unknown): SheetAnimation | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const stored = value as Record<string, unknown>;
    if (typeof stored['css'] !== 'string' || stored['css'].trim().length === 0) return undefined;
    const css = stored['css'];
    // A payload written before a sheet could tune carries the animation
    // and no kind, and reads as the only answer that existed then.
    if (stored['kind'] === 'tuned') {
      const values = SheetAnimationSet.readTuned(stored['values']);
      return values === undefined ? undefined : { kind: 'tuned', values, css };
    }
    const animation = StoredElementAnimation.read(stored['animation']);
    return animation === undefined ? undefined : { kind: 'replaced', animation, css };
  }

  /**
   * A stored value that does not hold is dropped rather than carried
   * into a panel that would then have to describe it, and the property
   * falls back to whatever the template gave it, which renders.
   */
  private static readTuned(value: unknown): TunedPropertyValues | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const values: Record<string, AnimationValue> = {};
    for (const [property, held] of Object.entries(value)) {
      const read = SheetAnimationSet.readValue(held);
      if (read !== undefined) values[property] = read;
    }
    return Object.keys(values).length > 0 ? values : undefined;
  }

  private static readValue(held: unknown): AnimationValue | undefined {
    if (held === null || typeof held !== 'object') return undefined;
    const stored = held as Record<string, unknown>;
    if (stored['kind'] === 'number' && typeof stored['amount'] === 'number' && typeof stored['unit'] === 'string') {
      return { kind: 'number', amount: stored['amount'], unit: stored['unit'] };
    }
    if (stored['kind'] === 'text' && typeof stored['text'] === 'string') {
      return { kind: 'text', text: stored['text'] };
    }
    return undefined;
  }

  /** What the sheet told this kind of element, or `null` when it was left to the template. */
  get(scope: ElementAnimationScope): SheetAnimation | null {
    return this.byScope.get(scope) ?? null;
  }

  /**
   * The same answers with this kind's replaced, or taken back when
   * `answer` is `undefined`. A scope naming no kind is ignored.
   *
   * Returns itself when there was nothing to take back, so a caller
   * can tell a real change from a no-op by identity rather than by
   * asking first.
   */
  with(scope: ElementAnimationScope, answer: SheetAnimation | undefined): SheetAnimationSet {
    if (ANIMATED_KIND_BY_SCOPE[scope] === null) return this;
    if (answer === undefined && !this.byScope.has(scope)) return this;
    const next = new Map(this.byScope);
    if (answer === undefined) next.delete(scope);
    else next.set(scope, answer);
    return new SheetAnimationSet(next);
  }

  /**
   * Every block the sheet holds, outermost kind first, as one text.
   *
   * The order is for whoever reads it: the blocks address kinds that
   * never meet on the same element, so none of them can outrank
   * another whatever order they arrive in.
   */
  css(): string {
    const blocks: string[] = [];
    for (const scope of ELEMENT_ANIMATION_SCOPES) {
      const answer = this.byScope.get(scope);
      if (answer && answer.css.trim().length > 0) blocks.push(answer.css);
    }
    return blocks.join(SEPARATOR);
  }

  isEmpty(): boolean {
    return this.byScope.size === 0;
  }

  toSnapshot(): SheetAnimationSetSnapshot {
    return Object.fromEntries(this.byScope);
  }
}
