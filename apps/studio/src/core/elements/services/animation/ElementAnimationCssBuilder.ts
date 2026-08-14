import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import {
  ANSWERED_BY_KIND,
  CAPTION_NODE_KINDS,
  CSS_CLASS_BY_NODE_KIND,
} from '@core/elements/domain/CaptionNodeKind';
import { ANIMATED_KIND_BY_SCOPE, type ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementControl } from '@core/elements/domain/ElementControl';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';

const NO_ANIMATION = 'animation: none;';
const INDENT = '  ';

/**
 * The CSS an animation renders as, built from what was picked for it —
 * for one element's part, or for every element of a kind.
 *
 * One direction. The record says which animation and what its fields
 * hold; this says what that looks like in CSS, and nothing ever asks
 * the CSS the question back.
 *
 * An animation the catalogue no longer offers produces nothing rather
 * than a broken rule — a project saved against an older library keeps
 * rendering, minus an animation nobody can name.
 */
export class ElementAnimationCssBuilder {
  constructor(
    private readonly catalog: ElementAnimationCatalog,
    private readonly timingVariableResolver: ElementTimingVariableResolver,
    private readonly controlValues: ElementControlCssWriter,
  ) {}

  /**
   * The block for one of an element's parts, to sit inside that
   * element's own rule.
   *
   * Carries the same silencing of generated boxes the sheet's block
   * does, for the same reason and by the same rule — see
   * `buildForEveryElement`.
   */
  build(animation: ElementAnimation, kind: ElementKind, scope: ElementAnimationScope): string {
    const reached = ANIMATED_KIND_BY_SCOPE[scope];
    const silenced = reached === null
      ? this.silencedUnder('&', kind)
      : this.silencedUnder(`& :where(.${CSS_CLASS_BY_NODE_KIND[reached]})`, reached);
    if (animation.presetId === null) return `${this.aimedAt(NO_ANIMATION, scope)}\n${silenced}`;
    const preset = this.catalog.byId(animation.presetId);
    if (!preset) return '';
    const declarations = this.catalog.declarationsFor(preset, this.timingVariableResolver.resolve(kind, scope));
    const tuned = this.withParams(declarations, preset.controls, animation.params);
    return `${this.aimedAt(tuned, scope)}\n${silenced}\n\n${preset.keyframes}`;
  }

  /**
   * The block for every element the scope names, as a rule of its own.
   *
   * No `:where` and no element around it: this lands in a layer of its
   * own, where nothing it could collide with lives, and an element
   * answering for itself wins by sitting in a later layer rather than
   * by out-weighing anything. Empty for a scope that names no kind —
   * there is no element here for `self` to mean.
   *
   * The elements' own generated boxes are silenced along with them. A
   * stylesheet can animate a `::before` — a highlight pill growing
   * behind its word — and that is a different element, so the rule
   * above never reaches it and the two would play at once. Silencing
   * is all that is right: the pill is not the word, and giving it the
   * word's new entrance would animate a box the answer never mentioned.
   *
   * Every state of the element is already covered without naming one.
   * A word being narrated still carries `word`, so a rule on the bare
   * class lands on the same element as one on `word-being-narrated` and
   * beats it by layer. Nothing here enumerates states, and nothing
   * needs `!important`: that is reserved for a rule a user wrote by
   * hand, which is meant to win.
   */
  buildForEveryElement(animation: ElementAnimation, scope: ElementAnimationScope): string {
    const kind = ANIMATED_KIND_BY_SCOPE[scope];
    if (kind === null) return '';
    const silenced = this.silencedUnder(`.${CSS_CLASS_BY_NODE_KIND[kind]}`, kind);
    if (animation.presetId === null) return `${this.asOwnRule(NO_ANIMATION, kind)}\n\n${silenced}`;
    const preset = this.catalog.byId(animation.presetId);
    if (!preset) return '';
    const declarations = this.catalog.declarationsFor(preset, this.timingVariableResolver.resolve(kind, scope));
    const tuned = this.withParams(declarations, preset.controls, animation.params);
    return `${this.asOwnRule(tuned, kind)}\n\n${silenced}\n\n${preset.keyframes}`;
  }

  /**
   * Everything an answer about `kind` takes over, given the selector
   * `answered` that reaches those elements.
   *
   * Its own generated boxes, and every node inside it that no answer of
   * its own covers — a line under a caption, a letter under a word.
   * Read off `ANSWERED_BY_KIND`, so a node kind added later is silenced
   * by whichever answer claims it rather than left animating under one
   * that replaced it.
   *
   * No pseudo-element exists unless the stylesheet gave it `content`,
   * and no class matches a node the document does not emit, so this
   * reaches nothing on a caption that has none.
   */
  private silencedUnder(answered: string, kind: ElementKind): string {
    const subjects = [answered];
    for (const node of CAPTION_NODE_KINDS) {
      if (node === kind || ANSWERED_BY_KIND[node] !== kind) continue;
      subjects.push(`${answered} .${CSS_CLASS_BY_NODE_KIND[node]}`);
    }
    const selectors = subjects.flatMap((subject) => [`${subject}::before`, `${subject}::after`]);
    for (const subject of subjects.slice(1)) selectors.push(subject);
    return `${selectors.join(', ')} {\n${INDENT}${NO_ANIMATION}\n}`;
  }

  /**
   * The CSS that moves values inside the animation a template already
   * applies to every element of a kind.
   *
   * No `animation` and no keyframes: the template's own rule still
   * declares both, and this only re-answers the custom properties that
   * rule reads. Which is what lets it reach a rule addressed by a
   * selector nothing here knows — the two land on the same element,
   * and layer order is settled before specificity is consulted.
   */
  buildTunedForEveryElement(
    values: Readonly<Record<string, AnimationValue>>,
    scope: ElementAnimationScope,
  ): string {
    const kind = ANIMATED_KIND_BY_SCOPE[scope];
    if (kind === null) return '';
    const declarations = Object.entries(values).map(([property, value]) => `${property}: ${this.spelled(value)};`);
    return declarations.length === 0 ? '' : this.asOwnRule(declarations.join('\n'), kind);
  }

  private spelled(value: AnimationValue): string {
    return value.kind === 'number' ? `${value.amount}${value.unit}` : value.text;
  }

  private asOwnRule(declarations: string, kind: ElementKind): string {
    return `.${CSS_CLASS_BY_NODE_KIND[kind]} {\n${this.indented(declarations)}\n}`;
  }

  /**
   * The declarations wrapped in whatever it takes to land them on the
   * scope's own elements.
   *
   * A scope reaching inside is written with `:where`, so it carries no
   * specificity of its own: an element addressed directly and an
   * element reached through the one around it then meet at the same
   * weight, and the order they are written in is what separates them.
   */
  private aimedAt(declarations: string, scope: ElementAnimationScope): string {
    const reached = ANIMATED_KIND_BY_SCOPE[scope];
    if (reached === null) return declarations;
    return `& :where(.${CSS_CLASS_BY_NODE_KIND[reached]}) {\n${this.indented(declarations)}\n}`;
  }

  private indented(declarations: string): string {
    return declarations
      .split('\n')
      .map((line) => (line.trim().length > 0 ? `${INDENT}${line}` : line))
      .join('\n');
  }

  /**
   * The animation's own declarations, moved to where the fields were
   * left. Written through the same arithmetic a field writes with,
   * because a direction and a distance can share one declaration and
   * neither may drop the other's half.
   */
  private withParams(
    declarations: string,
    controls: ReadonlyArray<ElementControl>,
    params: ElementAnimation['params'],
  ): string {
    let css = declarations;
    for (const control of controls) {
      const value = params[control.id];
      if (value !== undefined) css = this.controlValues.write(css, control, value);
    }
    return css;
  }
}
