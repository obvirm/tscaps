import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';

const ANIMATION_FOLDER = /\/animation\/([a-z-]+)\/controls\.json$/;

/**
 * The fields each animation in the library offers, whatever else is
 * true about it.
 *
 * Wider than {@link ElementAnimationCatalog}, which holds the
 * entrances a user can pick from a grid. An animation the picker never
 * offers still has fields worth reaching: a template applying
 * `settle-in` wants its distance as much as a user picking `rise-in`
 * wants theirs.
 *
 * Fields only. What an animation renders as, and the clock it anchors
 * to, belong to whoever is running it.
 */
export class AnimationFieldCatalog {
  constructor(private readonly fieldsByAnimation: Readonly<Record<string, ReadonlyArray<AuthoredElementControl>>>) {}

  /** The fields the animation offers, empty when it offers none or the library has no such animation. */
  fieldsOf(animationId: string): ReadonlyArray<AuthoredElementControl> {
    return this.fieldsByAnimation[animationId] ?? [];
  }

  /**
   * Keys each animation's field list by the folder it was authored in,
   * which is the animation's own name.
   */
  static byFolder(byPath: Readonly<Record<string, unknown>>): AnimationFieldCatalog {
    const fieldsByAnimation: Record<string, ReadonlyArray<AuthoredElementControl>> = {};
    for (const [path, fields] of Object.entries(byPath)) {
      const id = ANIMATION_FOLDER.exec(path)?.[1];
      if (id === undefined) throw new Error(`Unexpected animation fields path: "${path}"`);
      fieldsByAnimation[id] = fields as ReadonlyArray<AuthoredElementControl>;
    }
    return new AnimationFieldCatalog(fieldsByAnimation);
  }
}
