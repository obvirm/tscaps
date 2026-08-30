import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { ElementKind } from '@core/elements/domain/ElementKind';

/**
 * The entrances an element can be given, in the order the animation
 * library lists them.
 */
export class ElementAnimationCatalog {
  constructor(private readonly presets: ReadonlyArray<ElementAnimationPreset>) {}

  all(): ReadonlyArray<ElementAnimationPreset> {
    return this.presets;
  }

  /**
   * The entrances that exist for one kind of element.
   *
   * An entrance the library writes for a single kind is offered for that
   * kind alone, and asking for another gets a shorter list rather than
   * an entrance that would be applied against a clock it was never
   * compiled for.
   */
  forKind(kind: ElementKind): ReadonlyArray<ElementAnimationPreset> {
    return this.presets.filter((preset) => preset.kinds.includes(kind));
  }

  byId(id: string): ElementAnimationPreset | null {
    return this.presets.find((preset) => preset.id === id) ?? null;
  }

  /**
   * The declarations that give an element this entrance while anchored
   * to `timingVariable`. Throws when the entrance was never compiled
   * against that clock, which means the artifact and the element kinds
   * have gone out of step.
   */
  declarationsFor(preset: ElementAnimationPreset, timingVariable: string): string {
    const declarations = preset.declarationsByTimingVariable[timingVariable];
    if (declarations === undefined) {
      throw new Error(`Entrance "${preset.id}" was not built for elements anchored to ${timingVariable}.`);
    }
    return declarations;
  }
}
