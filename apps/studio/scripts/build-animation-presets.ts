import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileString } from 'sass';
import { CssKeyframesScanner, CssMinifier, CssCustomPropertyDefinitionScanner } from '@tscaps/engine';
import type { AuthoredElementControl, ElementControl } from '@core/elements/domain/ElementControl';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { ELEMENT_KINDS, type ElementKind } from '@core/elements/domain/ElementKind';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { TemplateAnimationRegistry } from '@core/templates/services/animations/TemplateAnimationRegistry';
import { TemplateStyleControlRegistry } from '@core/templates/services/controls/TemplateStyleControlRegistry';
import { controlFieldFunction } from './control-field-function';
import { declaredAnimationFunction } from './declared-animation-function';

const SOURCE_MODULE = 'animation/presets';
const OUTPUT_FILE = 'presets.build.json';
const CONTROLS_FILE = 'controls.json';
const ICON_FILE = 'icon.svg';

const keyframesScanner = new CssKeyframesScanner();
const minifier = new CssMinifier();
const customPropertyScanner = new CssCustomPropertyDefinitionScanner();
const timingVariableResolver = new ElementTimingVariableResolver();
const controlValueParser = new ElementControlValueParser();

/** A top-level block of a compiled stylesheet: what precedes its braces, and what they hold. */
interface CssBlock {
  readonly prelude: string;
  readonly body: string;
  readonly text: string;
}

/** One compile of the entrance list: what it rendered as, and what each entrance said about itself. */
interface CompiledLibrary {
  readonly css: string;
  readonly declared: readonly DeclaredAnimation[];
}

/** An entrance as compiled, before the editor's fields and its picture are attached to it. */
type CompiledPreset = Omit<ElementAnimationPreset, 'controls' | 'icon'>;

/** An entrance with its fields attached, still waiting for its picture. */
type PresetWithControls = Omit<ElementAnimationPreset, 'icon'>;

/**
 * Compiles the animation library's entrance list once per clock an
 * element can anchor to, and writes the result beside it.
 *
 * The list is the stylesheet's own: one rule per entrance, the selector
 * naming it. Nothing here decides which entrances exist, so adding one
 * is an edit to the stylesheet alone.
 */
export function buildAnimationPresets(libraryDir: string): void {
  const presets = new Map<string, CompiledPreset>();
  const declared = new Map<string, Readonly<Record<string, AnimationValue>>>();
  for (const kind of ELEMENT_KINDS) {
    const timingVariable = timingVariableResolver.resolve(kind, ElementAnimationScope.SELF);
    const compiled = compilePresets(libraryDir, kind, timingVariable);
    collectInto(presets, timingVariable, compiled.css);
    for (const animation of compiled.declared) declared.set(animation.id, animation.values);
  }
  if (presets.size === 0) throw new Error(`${SOURCE_MODULE} declared no entrances.`);
  const built = attachIcons(attachControls([...presets.values()], libraryDir, declared), libraryDir);
  writeFileSync(
    join(libraryDir, 'animation', OUTPUT_FILE),
    `${JSON.stringify(built, null, 2)}\n`,
  );
  console.log(`✓ ${built.length} element entrances built to animation/${OUTPUT_FILE}.`);
}

/**
 * Gives each entrance the picture the editor draws it as.
 *
 * Authored beside the animation rather than derived from it: the
 * library is written in `em` against caption text, so an entrance
 * rendered at the size of a picker card moves a pixel or two and shows
 * nothing. Every entrance must have one, so adding one to the
 * stylesheet is a decision about how it is recognised rather than a
 * silent blank.
 */
function attachIcons(presets: PresetWithControls[], libraryDir: string): ElementAnimationPreset[] {
  return presets.map((preset) => {
    const path = join(libraryDir, 'animation', preset.id, ICON_FILE);
    if (!existsSync(path)) {
      throw new Error(`Entrance "${preset.id}" has no icon. Draw one at animation/${preset.id}/${ICON_FILE}.`);
    }
    return { ...preset, icon: collapseWhitespace(readFileSync(path, 'utf8')) };
  });
}

function collapseWhitespace(svg: string): string {
  return svg.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

/**
 * The fields one animation declares for itself, in the order it lists
 * them.
 *
 * Every animation carries the file, with `[]` where it offers none, so
 * writing one is a decision about what it exposes rather than a silent
 * no. Animations the picker never offers carry it too: a template
 * applying one still wants its fields.
 */
function readAuthoredControls(libraryDir: string, id: string): AuthoredElementControl[] {
  const path = join(libraryDir, 'animation', id, CONTROLS_FILE);
  if (!existsSync(path)) {
    throw new Error(`Animation "${id}" declares no fields. Write animation/${id}/${CONTROLS_FILE}, with [] if it offers none.`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as AuthoredElementControl[];
}

/** Gives each entrance the fields the editor offers for it, and the value it ships each at. */
function attachControls(
  presets: ReadonlyArray<CompiledPreset>,
  libraryDir: string,
  declared: ReadonlyMap<string, Readonly<Record<string, AnimationValue>>>,
): PresetWithControls[] {
  return presets.map((preset) => {
    const authoredControls = readAuthoredControls(libraryDir, preset.id);
    rejectUnreachableControls(preset, authoredControls);
    rejectHalfSplitControls(preset, authoredControls);
    const values = declared.get(preset.id) ?? {};
    const controls = authoredControls.map((control) => ({
      ...control,
      defaultValue: shippedValue(preset, control, values),
    }));
    return { ...preset, controls };
  });
}

/**
 * A control can only drive a property the entrance declares for
 * itself. One it merely reads belongs to whatever scope wrote it, and
 * a field over that would either move nothing or reach outside the
 * element it is shown for.
 */
function rejectUnreachableControls(preset: CompiledPreset, controls: ReadonlyArray<AuthoredElementControl>): void {
  for (const control of controls) {
    if (preset.customProperties.includes(control.property)) continue;
    throw new Error(`Entrance "${preset.id}" offers "${control.label}" over ${control.property}, which it never declares.`);
  }
}

/**
 * A signed value split between a direction and a distance needs both
 * halves. One alone either loses the direction or cannot express one.
 */
function rejectHalfSplitControls(preset: CompiledPreset, controls: ReadonlyArray<AuthoredElementControl>): void {
  for (const control of controls) {
    if (control.part === 'whole') continue;
    const partner = control.part === 'sign' ? 'magnitude' : 'sign';
    if (controls.some((other) => other.property === control.property && other.part === partner)) continue;
    throw new Error(`Entrance "${preset.id}" splits ${control.property} but offers no ${partner} to go with its ${control.part}.`);
  }
}

/**
 * The value the entrance ships this field at, taken from what the
 * entrance declared.
 *
 * The same record a template's own animations produce, so the number a
 * field starts on and the number the entrance renders at are one value
 * rather than two readings of it. Throws where a template would only
 * lose a dial: an entrance whose fields and declarations disagree is
 * the library contradicting itself.
 */
function shippedValue(
  preset: CompiledPreset,
  control: AuthoredElementControl,
  values: Readonly<Record<string, AnimationValue>>,
): ElementControlValue {
  const declared = values[control.property];
  if (declared === undefined) {
    throw new Error(`Entrance "${preset.id}" offers "${control.label}" over ${control.property}, which it never sets a value for.`);
  }
  const held = controlValueParser.parse(control, declared);
  if (held === null) {
    throw new Error(`Entrance "${preset.id}" ships "${control.label}" as something its field cannot hold.`);
  }
  return held;
}

function compilePresets(libraryDir: string, kind: ElementKind, timingVariable: string): CompiledLibrary {
  const registry = new TemplateStyleControlRegistry(new StyleControlCatalog(new SimilarNameFinder()));
  // The entrance list is not a template, but what the primitives
  // declare about themselves here is the same record, and it is where
  // each field's shipped value comes from.
  const animations = new TemplateAnimationRegistry();
  const css = compileString(
    `@use '${SOURCE_MODULE}';\n@include presets.all(var(${timingVariable}), '${kind}');\n`,
    {
      style: 'expanded',
      loadPaths: [libraryDir],
      functions: {
        'tscaps-control-field($id, $default)': controlFieldFunction(registry),
        'tscaps-declared-animation($id, $element, $values, $keyframes)': declaredAnimationFunction(animations),
      },
    },
  ).css;
  return { css: stripComments(css).replace(/@charset[^;]*;/g, ''), declared: animations.declared() };
}

/**
 * Folds one compilation into the entrances collected so far. The first
 * clock establishes each entrance; later ones contribute only their
 * declarations, and must agree on everything else.
 */
function collectInto(
  presets: Map<string, CompiledPreset>,
  timingVariable: string,
  css: string,
): void {
  const blocks = topLevelBlocks(css);
  const keyframesByName = keyframeBlocksByName(blocks);
  for (const rule of blocks.filter(isPresetRule)) {
    const id = rule.prelude.trim().slice(1);
    const declarations = dedent(rule.body);
    const keyframeName = soleKeyframeReference(id, declarations);
    const keyframes = keyframesByName.get(keyframeName);
    if (!keyframes) {
      throw new Error(`Entrance "${id}" animates "${keyframeName}", which the library never defines.`);
    }
    const existing = presets.get(id);
    if (!existing) {
      presets.set(id, {
        id,
        keyframeName,
        customProperties: [...customPropertyScanner.scan(minifier.minify(declarations))],
        keyframes,
        declarationsByTimingVariable: { [timingVariable]: declarations },
      });
      continue;
    }
    if (existing.keyframes !== keyframes) {
      throw new Error(`Entrance "${id}" compiles different keyframes depending on the clock it anchors to.`);
    }
    presets.set(id, {
      ...existing,
      declarationsByTimingVariable: { ...existing.declarationsByTimingVariable, [timingVariable]: declarations },
    });
  }
  rejectSharedKeyframes(presets);
}

/**
 * An entrance is recognised in a user's CSS by the keyframes its
 * animation names, so two entrances sharing one would be
 * indistinguishable once written.
 */
function rejectSharedKeyframes(presets: ReadonlyMap<string, CompiledPreset>): void {
  const owners = new Map<string, string>();
  for (const preset of presets.values()) {
    const owner = owners.get(preset.keyframeName);
    if (owner && owner !== preset.id) {
      throw new Error(
        `Entrances "${owner}" and "${preset.id}" both animate "${preset.keyframeName}", `
        + 'so neither could be told from the other once written into an element.',
      );
    }
    owners.set(preset.keyframeName, preset.id);
  }
}

function soleKeyframeReference(id: string, declarations: string): string {
  const referenced = [...keyframesScanner.referencedNames(minifier.minify(declarations))];
  if (referenced.length === 1) return referenced[0]!;
  if (referenced.length === 0) throw new Error(`Entrance "${id}" animates nothing.`);
  throw new Error(
    `Entrance "${id}" animates ${referenced.length} keyframes at once. `
    + 'A primitive writes its own "animation", so combining two keeps only the second.',
  );
}

function isPresetRule(block: CssBlock): boolean {
  return block.prelude.trim().startsWith('.');
}

function keyframeBlocksByName(blocks: ReadonlyArray<CssBlock>): Map<string, string> {
  const byName = new Map<string, string>();
  for (const block of blocks) {
    for (const name of keyframesScanner.definedNames(block.prelude)) {
      byName.set(name, block.text.trim());
    }
  }
  return byName;
}

function topLevelBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor);
    if (open === -1) break;
    const close = matchingClose(css, open);
    blocks.push({
      prelude: css.slice(cursor, open),
      body: css.slice(open + 1, close),
      text: css.slice(cursor, close + 1).trim(),
    });
    cursor = close + 1;
  }
  return blocks;
}

function matchingClose(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  throw new Error('Unbalanced braces in the compiled entrance list.');
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Drops the indentation a rule's body carries from sitting inside it, so the declarations read as written. */
function dedent(body: string): string {
  const lines = body.split('\n').filter((line) => line.trim().length > 0);
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent)).join('\n');
}
