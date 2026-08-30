import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { FontScript } from '@core/fonts/domain/FontCatalog';
import type { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import type { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import type { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';

const FONT_FAMILY_DECLARATION = /font-family\s*:\s*([^;}]+)/g;
const QUOTED_FAMILY_NAME = /['"]([^'"]+)['"]/g;

export interface SheetFontFamilyCollectorInput {
  readonly sheet: Sheet;
  readonly document: Document;
  readonly inlineStyles: Record<string, string>;
  readonly sheetCss: string;
  readonly elementStyles: ElementStyles;
}

/**
 * Builds the deduplicated set of font families a sheet will render
 * with at export time, drawn from every source that can introduce a
 * family:
 *
 *  1. The sheet's primary typography font.
 *  2. The face given to any single word or segment.
 *  3. The user's value for every `font`-typed styleControl the
 *     template exposes.
 *  4. Family names hard-coded in the template CSS, and in the CSS of
 *     every element the sheet renders — quoted literals *outside*
 *     `var(...)` expressions. `var(...)` fallbacks are skipped because
 *     the user-set value via sources 1–3 always wins; embedding their
 *     unused fonts would bundle ~50–200 KB of payload per rendered
 *     frame for nothing.
 *
 * A stack's stand-ins are kept only for the scripts the sheet's text
 * actually holds. The one for a script nobody wrote a character of
 * cannot be selected to draw anything, and the same payload argument
 * applies to it.
 *
 * The result is meant to feed `FontFaceCssBuilder.build` so each
 * frame's embedded stylesheet ships only the `@font-face` blocks the
 * captions actually use.
 */
export class SheetFontFamilyCollector {

  constructor(
    private readonly fontStackResolver: FontStackResolver,
    private readonly drawableFamilyResolver: DrawableFamilyResolver,
    private readonly scriptClassifier: FontScriptClassifier,
    private readonly captionTextCollector: SheetCaptionTextCollector,
  ) {}

  collect(input: SheetFontFamilyCollectorInput): Set<string> {
    const families = new Set<string>();
    const scripts = this.scriptsOf(input);
    this.addPrimaryFamily(input.inlineStyles, scripts, families);
    this.addPerElementFamilies(input, scripts, families);
    this.addFontControlFamilies(input.sheet, input.inlineStyles, scripts, families);
    this.addCssLiteralFamilies(input.sheetCss, families);
    this.addElementCssLiteralFamilies(input.elementStyles, families);
    return families;
  }

  private scriptsOf(input: SheetFontFamilyCollectorInput): ReadonlySet<FontScript> {
    return this.scriptClassifier.scriptsIn(
      this.captionTextCollector.collect(input.document, input.sheet.id),
    );
  }

  private addPrimaryFamily(
    inlineStyles: Record<string, string>,
    scripts: ReadonlySet<FontScript>,
    out: Set<string>,
  ): void {
    this.addStack(inlineStyles[TemplateCssVariable.FONT_FAMILY], scripts, out);
  }

  // A chosen face is collected as its full stack: the element renders
  // with that face's stand-ins when its text is in a script the face
  // cannot draw, and those are not necessarily in the sheet's own stack.
  private addPerElementFamilies(
    input: SheetFontFamilyCollectorInput,
    scripts: ReadonlySet<FontScript>,
    out: Set<string>,
  ): void {
    for (const section of input.document.sections) {
      if (section.kind !== input.sheet.id) continue;
      for (const segment of section.segments) {
        this.addChosenFace(input.elementStyles, segment.id, scripts, out);
        for (const word of segment.getWords()) {
          this.addChosenFace(input.elementStyles, word.id, scripts, out);
        }
      }
    }
  }

  private addChosenFace(
    elementStyles: ElementStyles,
    elementId: string,
    scripts: ReadonlySet<FontScript>,
    out: Set<string>,
  ): void {
    const family = elementStyles.fieldText(elementId, ElementFieldId.FONT_FAMILY);
    if (family === null) return;
    this.addStack(this.fontStackResolver.resolve(family), scripts, out);
  }

  // Every element's CSS is scanned, not only the ones a field wrote:
  // the text is editable, so a face can arrive there without any field
  // holding it, and a family nobody collects is a family the export
  // ships no `@font-face` for.
  private addElementCssLiteralFamilies(elementStyles: ElementStyles, out: Set<string>): void {
    for (const style of elementStyles.all().values()) {
      this.addCssLiteralFamilies(style.css, out);
    }
  }

  private addFontControlFamilies(
    sheet: Sheet,
    inlineStyles: Record<string, string>,
    scripts: ReadonlySet<FontScript>,
    out: Set<string>,
  ): void {
    for (const control of sheet.template.styleControls) {
      if (control.type !== 'font') continue;
      this.addStack(inlineStyles[`--tscaps-${control.id}`], scripts, out);
    }
  }

  private addCssLiteralFamilies(css: string, out: Set<string>): void {
    for (const declaration of css.matchAll(FONT_FAMILY_DECLARATION)) {
      const withoutVars = this.stripVarExpressions(declaration[1]!);
      for (const family of withoutVars.matchAll(QUOTED_FAMILY_NAME)) {
        out.add(family[1]!);
      }
    }
  }

  /**
   * Removes every `var(...)` expression from `value`, matching nested
   * parentheses so the entire expression (including its fallback
   * argument) drops out cleanly.
   */
  private stripVarExpressions(value: string): string {
    let result = '';
    let i = 0;
    while (i < value.length) {
      if (value.startsWith('var(', i)) {
        i = this.findParenExpressionEnd(value, i + 4);
        continue;
      }
      result += value[i];
      i++;
    }
    return result;
  }

  /** Returns the index just past the `)` that closes the parenthesised expression starting at `openParenIndex`. */
  private findParenExpressionEnd(value: string, openParenIndex: number): number {
    let depth = 1;
    let i = openParenIndex;
    while (i < value.length && depth > 0) {
      const ch = value[i]!;
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    return i;
  }

  private addStack(
    value: string | undefined,
    scripts: ReadonlySet<FontScript>,
    out: Set<string>,
  ): void {
    if (!value) return;
    for (const family of this.drawableFamilyResolver.resolve(value, scripts)) out.add(family);
  }
}
