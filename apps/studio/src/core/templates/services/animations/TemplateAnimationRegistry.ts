import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import { CAPTION_NODE_KINDS, type CaptionNodeKind } from '@core/elements/domain/CaptionNodeKind';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import { AgreedAnimationValues } from '@core/templates/services/animations/AgreedAnimationValues';

/**
 * Collects the library animations one template applies while its
 * stylesheet is compiled, and the value it gives each of their fields.
 * An animation primitive declares itself here, so how a template moves
 * reaches the template without it having to say so a second time.
 *
 * Applying the same animation twice to one kind of element is one
 * answer stated twice and collapses into one entry, keeping whatever
 * the two agreed on. The same animation on two kinds does not: a
 * caption that rises and whose words rise after it is two answers, and
 * they are declared on two different elements.
 *
 * One instance covers one template: it accumulates and never resets.
 */
export class TemplateAnimationRegistry {
  private readonly appliedByKey = new Map<string, AppliedAnimation>();

  /**
   * Records `id` as applied to the elements of `element`, giving its
   * properties `values`.
   *
   * A kind outside the vocabulary is refused rather than recorded: it
   * would name an element no dial could ever be written for, and a
   * typo is the likeliest way to get one.
   */
  declare(
    id: string,
    element: string,
    values: ReadonlyMap<string, AnimationValue>,
    keyframes: readonly string[],
  ): void {
    const kind = this.kindNamed(id, element);
    const key = `${id}@${kind}`;
    const applied = this.appliedByKey.get(key)
      ?? { id, element: kind, values: new AgreedAnimationValues(), keyframes: new Set<string>() };
    applied.values.add(values);
    for (const name of keyframes) applied.keyframes.add(name);
    this.appliedByKey.set(key, applied);
  }

  declared(): readonly DeclaredAnimation[] {
    return [...this.appliedByKey.values()].map(({ id, element, values, keyframes }) => ({
      id,
      element,
      values: values.agreed(),
      keyframes: [...keyframes],
    }));
  }

  /** Every `@keyframes` block the animations declared here are made of. */
  keyframeNames(): ReadonlySet<string> {
    const names = new Set<string>();
    for (const applied of this.appliedByKey.values()) {
      for (const name of applied.keyframes) names.add(name);
    }
    return names;
  }

  private kindNamed(id: string, element: string): CaptionNodeKind {
    const found = CAPTION_NODE_KINDS.find((known) => known === element);
    if (found === undefined) {
      throw new Error(
        `Animation "${id}" was declared on "${element}", which is not an element. `
        + `Name one of: ${CAPTION_NODE_KINDS.join(', ')}.`,
      );
    }
    return found;
  }
}

/** One animation on one kind of element, while its call sites are still being collected. */
interface AppliedAnimation {
  readonly id: string;
  readonly element: CaptionNodeKind;
  readonly values: AgreedAnimationValues;
  readonly keyframes: Set<string>;
}
