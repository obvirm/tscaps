import { CssBlockSealer, CssKeyframeNamespacer, CssMinifier, DataAttribute } from '@tscaps/engine';
import { CaptionCssLayer } from '@core/captions/domain/CaptionCssLayer';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { SheetAnimationSet } from '@core/sheets/domain/SheetAnimationSet';

const NON_IDENTIFIER_CHARACTERS = /[^a-zA-Z0-9_-]/g;
const ATTRIBUTE_VALUE_SPECIAL_CHARACTERS = /["\\]/g;
// The sheet's blocks address different kinds, so one key for all of
// them can never collide with itself.
const SHEET_KEYFRAME_KEY = 'sheet';

/**
 * Assembles the CSS a caption renders with, one cascade layer per
 * question answered: the template it started from, what the sheet said
 * about every element of a kind, and what one element said about
 * itself. Each wins over the one before it by arriving later, so none
 * of them has to out-specify another.
 *
 * A fragment is stored as declarations without a selector. The selector
 * is written here, so the stored text stays about the element and a
 * fragment moved to another element needs no rewriting. Nested rules
 * ride along inside the wrapper — `&:hover { … }` works — but
 * `@keyframes` cannot live inside a style rule, so those are lifted out
 * and renamed per element: keyframe names are global, and two elements
 * both defining `fade-in` would otherwise share whichever came last.
 *
 * Fragments are sealed before they go in. One with an unbalanced brace
 * would otherwise close the element layer early and leave every fragment
 * after it unlayered — one element's typo silently changing who wins for
 * all the others.
 *
 * The elements that wrap others are written first. A fragment can carry
 * a rule for what is inside the element, which meets that element's own
 * fragment at the same weight in the same layer, and then only the
 * order they were written in decides.
 */
export class LayeredCaptionCssBuilder {
  constructor(
    private readonly keyframeNamespacer: CssKeyframeNamespacer,
    private readonly minifier: CssMinifier,
    private readonly sealer: CssBlockSealer,
  ) {}

  build(templateCss: string, animations: SheetAnimationSet, styles: ElementStyles): string {
    const layers = [`@layer ${CaptionCssLayer.TEMPLATE} {\n${templateCss}\n}`];
    const sheetLayer = this.buildSheetLayer(animations);
    if (sheetLayer) layers.push(sheetLayer);
    const elementLayer = this.buildElementLayer(styles);
    if (elementLayer) layers.push(elementLayer);
    return layers.join('\n');
  }

  /**
   * What the sheet says about every element of a kind.
   *
   * Its keyframes are namespaced under one key for the whole sheet:
   * the blocks address different kinds and cannot define the same name
   * twice, and keeping the names off the scope means two sheets picking
   * one entrance still get a definition each.
   */
  private buildSheetLayer(animations: SheetAnimationSet): string {
    const css = animations.css();
    if (css.trim().length === 0) return '';
    const sealed = this.sealer.seal(this.minifier.minify(css)).css;
    const namespaced = this.keyframeNamespacer.namespace(sealed, SHEET_KEYFRAME_KEY);
    const { hoisted, remaining } = this.liftKeyframes(namespaced);
    const layer = `@layer ${CaptionCssLayer.SHEET} {\n${remaining.trim()}\n}`;
    return hoisted.length > 0 ? `${hoisted.join('\n')}\n${layer}` : layer;
  }

  private buildElementLayer(styles: ElementStyles): string {
    const rules: string[] = [];
    const keyframes: string[] = [];
    let position = 0;
    for (const [elementId, style] of styles.outermostFirst()) {
      const sealed = this.sealer.seal(this.minifier.minify(style.css)).css;
      const namespaced = this.keyframeNamespacer.namespace(sealed, this.keyframeKeyFor(elementId, position));
      position++;
      const { hoisted, remaining } = this.liftKeyframes(namespaced);
      keyframes.push(...hoisted);
      if (remaining.trim().length > 0) {
        rules.push(`[${DataAttribute.ELEMENT_ID}="${this.escapeAttributeValue(elementId)}"] {\n${remaining.trim()}\n}`);
      }
    }
    if (rules.length === 0 && keyframes.length === 0) return '';
    // Keyframes sit outside the layer: they define no declarations, so
    // layering them would only make the name resolution depend on order
    // that the per-element rename already settles.
    const layered = rules.length > 0 ? `@layer ${CaptionCssLayer.ELEMENT} {\n${rules.join('\n')}\n}` : '';
    return [keyframes.join('\n'), layered].filter(Boolean).join('\n');
  }

  /**
   * A keyframe-name suffix unique to this element and spellable as a CSS
   * identifier.
   *
   * Element ids are opaque and some carry punctuation — a decoration's
   * is built from its host word's. Dropped into a name verbatim, one
   * stray character makes the whole `@keyframes` block a syntax error
   * and takes the animation that referenced it down with it, silently.
   * The position is what guarantees uniqueness, since two ids can differ
   * only in the characters being replaced; the id itself rides along so
   * the name still says what it belongs to.
   */
  private keyframeKeyFor(elementId: string, position: number): string {
    return `${elementId.replace(NON_IDENTIFIER_CHARACTERS, '-')}-${position}`;
  }

  /** Escapes what would otherwise end the quoted attribute value early. */
  private escapeAttributeValue(value: string): string {
    return value.replace(ATTRIBUTE_VALUE_SPECIAL_CHARACTERS, '\\$&');
  }

  private liftKeyframes(css: string): { hoisted: string[]; remaining: string } {
    const hoisted: string[] = [];
    let remaining = '';
    let index = 0;
    while (index < css.length) {
      const start = this.findKeyframesStart(css, index);
      if (start === -1) {
        remaining += css.slice(index);
        break;
      }
      remaining += css.slice(index, start);
      const open = css.indexOf('{', start);
      if (open === -1) {
        remaining += css.slice(start);
        break;
      }
      const close = this.findMatchingClose(css, open);
      hoisted.push(css.slice(start, close + 1));
      index = close + 1;
    }
    return { hoisted, remaining };
  }

  private findKeyframesStart(css: string, from: number): number {
    const match = /@(?:-webkit-|-moz-)?keyframes\b/.exec(css.slice(from));
    return match ? from + match.index : -1;
  }

  /** Index of the `}` that closes the block opened at `open`, or the end of the string. */
  private findMatchingClose(css: string, open: number): number {
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      const ch = css[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return css.length - 1;
  }
}
