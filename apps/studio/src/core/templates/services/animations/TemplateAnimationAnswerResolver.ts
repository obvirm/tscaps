import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ANIMATED_KIND_BY_SCOPE, type ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';

/**
 * What a template already does to one kind of element, in the terms
 * the picker speaks.
 *
 * `entrance` is one of its cards. `still` is nothing moving that kind
 * at all, which the picker calls "None" — the same thing a sheet would
 * be asking for by picking it. `unnamed` is movement the picker has no
 * card for: something bespoke, something the library keeps out of the
 * list, or two animations at once.
 */
export type TemplateAnimationAnswer =
  | { readonly kind: 'entrance'; readonly presetId: string }
  | { readonly kind: 'still' }
  | { readonly kind: 'unnamed' };

/**
 * Which card in the picker a template's own movement already is.
 *
 * A sheet has nothing above it to defer to, so "as the template has
 * it" is a fact this can look up rather than a deferral, and naming
 * the movement beats naming where it came from. The template's own
 * card is then only for the movement the picker cannot name.
 *
 * **Every animation a template applies is declared**, its own keyframes
 * as much as the library's — which is what makes `still` mean nothing
 * moves rather than nothing was recorded. A template that animates
 * without declaring it reads here as still, and the caption would then
 * move under a panel saying it does not.
 *
 * Two animations on one kind are `unnamed`: the template's answer is
 * not one entrance, and picking either card would claim the other is
 * not running.
 */
export class TemplateAnimationAnswerResolver {
  constructor(private readonly animationCatalog: ElementAnimationCatalog) {}

  answerFor(
    applied: ReadonlyArray<DeclaredAnimation>,
    scope: ElementAnimationScope,
  ): TemplateAnimationAnswer {
    const kind = ANIMATED_KIND_BY_SCOPE[scope];
    if (kind === null) return { kind: 'unnamed' };
    const onKind = applied.filter((animation) => animation.element === kind);
    if (onKind.length === 0) return { kind: 'still' };
    if (onKind.length > 1) return { kind: 'unnamed' };
    const presetId = onKind[0]!.id;
    return this.animationCatalog.byId(presetId) === null
      ? { kind: 'unnamed' }
      : { kind: 'entrance', presetId };
  }
}
