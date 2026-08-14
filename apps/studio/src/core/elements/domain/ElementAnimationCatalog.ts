import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';

/**
 * The entrances an element can be given, in the order the animation
 * library lists them.
 */
export class ElementAnimationCatalog {
  constructor(private readonly presets: ReadonlyArray<ElementAnimationPreset>) {}

  all(): ReadonlyArray<ElementAnimationPreset> {
    return this.presets;
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
