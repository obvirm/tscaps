const DECLARATION_PATTERN = /(?:^|[;{}\s])(--[a-zA-Z0-9_-]+)\s*:/g;
const AT_PROPERTY_PATTERN = /@property\s+(--[a-zA-Z0-9_-]+)/g;

/**
 * Returns every CSS custom property the given source defines, either
 * as a `--name: value` declaration or as an `@property --name` rule.
 *
 * Cheap regex scan rather than a CSS parse; pass the source through
 * {@link CssMinifier} first so commented-out declarations don't
 * count. Style queries (`@container … style(--x: 1)`) don't register
 * as definitions: the leading guard rejects names preceded by `(`.
 */
export class CssCustomPropertyDefinitionScanner {

  scan(css: string): Set<string> {
    const found = new Set<string>();
    for (const match of css.matchAll(DECLARATION_PATTERN)) {
      found.add(match[1]!);
    }
    for (const match of css.matchAll(AT_PROPERTY_PATTERN)) {
      found.add(match[1]!);
    }
    return found;
  }
}
