const RECIPE_NAME_PATTERN = /<tscaps:recipe\b[^>]*\bname="([^"]+)"/;
const PARAM_PATTERN = /<tscaps:param\b([^>]*)\/>/g;
const ATTRIBUTE_PATTERN = /([\w:-]+)\s*=\s*"([^"]*)"/g;
const RECIPE_BODY_PATTERN = /<tscaps:recipe\b[^>]*>([\s\S]*)<\/tscaps:recipe>/;
const PLACEHOLDER_PATTERN = /\{([\w-]+)\}/g;
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

interface RecipeParameter {
  readonly name: string;
  readonly fallback: string | undefined;
}

/**
 * One named filter recipe: a fragment of SVG filter primitives with
 * `{placeholder}` slots, plus the parameters that fill them.
 *
 * A recipe owns the `--tscaps-*` names its primitives read, so a
 * template supplies only its own default values and cannot drift into
 * a private spelling of a shared control.
 *
 * Source shape — valid XML, so the file opens and validates in any XML
 * editor:
 *
 * ```xml
 * <tscaps:recipe xmlns:tscaps="https://tscaps.io/filters" name="outline">
 *   <tscaps:param name="thickness"/>
 *   <tscaps:param name="in" default="SourceAlpha"/>
 *   <feMorphology in="{in}" operator="dilate" radius="{thickness}"/>
 * </tscaps:recipe>
 * ```
 *
 * A parameter without a `default` is required at the call site.
 */
export class SvgFilterRecipe {
  private constructor(
    readonly name: string,
    private readonly parameters: readonly RecipeParameter[],
    private readonly body: string,
  ) {}

  static parse(source: string): SvgFilterRecipe {
    const name = RECIPE_NAME_PATTERN.exec(source)?.[1];
    if (!name) {
      throw new Error('A filter recipe needs a <tscaps:recipe name="…"> root element.');
    }
    const body = RECIPE_BODY_PATTERN.exec(source)?.[1];
    if (body === undefined) {
      throw new Error(`Recipe "${name}" has no <tscaps:recipe> body.`);
    }
    return new SvgFilterRecipe(
      name,
      SvgFilterRecipe.parseParameters(source),
      SvgFilterRecipe.cleanBody(body),
    );
  }

  /**
   * Reduces the authored body to the primitives alone, flush left.
   * Parameter declarations have already been read, and the prose
   * explaining the recipe belongs to whoever maintains it — copying it
   * into every template that calls the recipe would bury each one's own
   * notes. Dedenting lets the expansion take the indentation of
   * whatever call site it lands in, keeping relative indentation of
   * wrapped attributes intact.
   */
  private static cleanBody(body: string): string {
    const lines = body
      .replace(PARAM_PATTERN, '')
      .replace(COMMENT_PATTERN, '')
      .split('\n')
      .filter((line) => line.trim() !== '');
    const commonIndent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
    return lines.map((line) => line.slice(commonIndent)).join('\n');
  }

  /**
   * Substitutes the recipe's placeholders and returns the resulting
   * filter primitives. Throws when a required parameter is absent or
   * when an argument matches no declared parameter — a typo at the call
   * site would otherwise expand to a filter that silently does nothing.
   */
  render(args: ReadonlyMap<string, string>): string {
    const values = this.resolveValues(args);
    return this.body.replace(PLACEHOLDER_PATTERN, (placeholder, key: string) => {
      const value = values.get(key);
      if (value === undefined) {
        throw new Error(`Recipe "${this.name}" uses ${placeholder}, which it never declares as a <tscaps:param>.`);
      }
      return value;
    });
  }

  private resolveValues(args: ReadonlyMap<string, string>): Map<string, string> {
    const declared = new Set(this.parameters.map((parameter) => parameter.name));
    for (const key of args.keys()) {
      if (!declared.has(key)) {
        throw new Error(
          `Recipe "${this.name}" takes no "${key}" parameter. It accepts: ${[...declared].join(', ')}.`,
        );
      }
    }
    const values = new Map<string, string>();
    for (const parameter of this.parameters) {
      const value = args.get(parameter.name) ?? parameter.fallback;
      if (value === undefined) {
        throw new Error(`Recipe "${this.name}" requires a "${parameter.name}" parameter.`);
      }
      values.set(parameter.name, value);
    }
    return values;
  }

  private static parseParameters(source: string): RecipeParameter[] {
    const parameters: RecipeParameter[] = [];
    for (const declaration of source.matchAll(PARAM_PATTERN)) {
      const attributes = SvgFilterRecipe.parseAttributes(declaration[1]!);
      const name = attributes.get('name');
      if (!name) {
        throw new Error('Every <tscaps:param> needs a name attribute.');
      }
      parameters.push({ name, fallback: attributes.get('default') });
    }
    return parameters;
  }

  static parseAttributes(source: string): Map<string, string> {
    const attributes = new Map<string, string>();
    for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
      attributes.set(match[1]!, match[2]!);
    }
    return attributes;
  }
}
