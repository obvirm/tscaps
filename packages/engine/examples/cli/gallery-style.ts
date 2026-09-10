import {
  CompositeSegmentSplitter,
  BoundarySegmentSplitter,
  BoundaryScoreLimitByCharsSegmentSplitter,
  LimitByWordsSegmentSplitter,
  GapFreeEffect,
  SmartPunctuationEffect,
  RemovePunctuationEffect,
  CarryQuotesEffect,
  SmartLowercaseEffect,
  SvgFilterDefinitionsParser,
  SvgFilterBundle,
  SvgFilterScope,
  type Effect,
  type SegmentSplitter,
  type SubtitleStyle,
} from '@tscaps/engine';

// Whole gallery, loaded statically: JSON + compiled CSS per template, plus
// the built SVG filters where the template ships them. Page-only module
// (glob + ?raw need Vite); the Node driver never imports this file.
const templateJsons = import.meta.glob('../../../../templates/*/template.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;
const buildCssFiles = import.meta.glob('../../../../templates/*/style.build.css', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;
const filtersSvgs = import.meta.glob('../../../../templates/*/filters.build.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export type GalleryTemplateName = string;

interface TemplateJson {
  typography: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    letterSpacing: number;
    wordSpacing: number;
    textAlign?: string;
    textCase?: string;
    italic?: boolean;
  };
  rendering?: {
    splitWordsIntoLetters?: boolean;
    videoFrame?: { required: boolean; jpegQuality?: number };
  };
  styleControls: ReadonlyArray<{
    id: string; type?: string; default: unknown; valueOn?: string; valueOff?: string;
    unit?: string; options?: ReadonlyArray<{ value: unknown; cssValue?: string }>;
  }>;
  segmentSplitters: ReadonlyArray<{
    type: string; mode?: string; maxChars?: number; minChars?: number;
  }>;
  lineSplitter: { type: string; maxLines: number };
  alignment: {
    verticalAlign: 'top' | 'center' | 'bottom';
    verticalOffset: number;
    horizontalAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
    horizontalOffset?: number;
  };
  effects: ReadonlyArray<{ type: string; enabled: boolean }>;
}

function templateNameOf(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 2]!;
}

function templateEntry(name: GalleryTemplateName): { json: TemplateJson; css: string; filters: string | null } {
  const jsonPath = Object.keys(templateJsons).find((p) => templateNameOf(p) === name);
  if (jsonPath === undefined) throw new Error(`gallery-style: unknown template ${name}`);
  const cssPath = Object.keys(buildCssFiles).find((p) => templateNameOf(p) === name);
  if (cssPath === undefined) throw new Error(`gallery-style: no built CSS for ${name}`);
  const filtersPath = Object.keys(filtersSvgs).find((p) => templateNameOf(p) === name);
  return {
    json: templateJsons[jsonPath] as TemplateJson,
    css: buildCssFiles[cssPath]!,
    filters: filtersPath === undefined ? null : filtersSvgs[filtersPath]!,
  };
}

/** Raw template.json for harness logic that needs fields beyond styles. */
export function galleryTemplateJson(name: GalleryTemplateName): unknown {
  return templateEntry(name).json;
}

/** Every template folder that ships a template.json. */
export function galleryTemplateNames(): GalleryTemplateName[] {
  return Object.keys(templateJsons).map(templateNameOf).sort();
}

// Boundary char tables copied from the studio descriptor that resolves them
// (apps/studio/.../BoundarySegmentSplitterDescriptor.ts): clause mode splits
// at sentence AND clause bases, each also recognized before a closing quote.
const CLOSING_QUOTES: readonly string[] = ['"', '”', '’', '»'];
const SENTENCE_BASES: readonly string[] = ['.', '?', '!', '...', '…', '؟', '۔', '。', '？', '！'];
const CLAUSE_ONLY_BASES: readonly string[] = [',', ';', ':', '،', '؛', '、', '，', '；', '：'];
const withClosingQuotes = (bases: readonly string[]): string[] =>
  bases.flatMap((base) => [base, ...CLOSING_QUOTES.map((quote) => base + quote)]);
const PRESET_SEPARATORS: Record<string, string[]> = {
  sentence: withClosingQuotes(SENTENCE_BASES),
  clause: withClosingQuotes([...SENTENCE_BASES, ...CLAUSE_ONLY_BASES]),
};

// Score-splitter studio default for an omitted minChars (descriptor defaultConfig).
const SCORE_MIN_CHARS_DEFAULT = 0;

/** Display family (matches the loaded font's registered name). */
export function galleryFontFamily(name: GalleryTemplateName): string {
  const family = templateEntry(name).json.typography.fontFamily;
  return family.endsWith(' Variable') ? family.slice(0, -' Variable'.length) : family;
}

/** Font stack the CSS must name for Takumi to hit the loaded font. */
export function galleryFontFamilyCss(name: GalleryTemplateName): string {
  const family = galleryFontFamily(name);
  if (family === 'JetBrains Mono') return '"JetBrains Mono", monospace';
  return `"${family}", sans-serif`;
}

/** Resolved display font size in px at the render height. */
export function galleryFontPx(name: GalleryTemplateName, height: number): number {
  return templateEntry(name).json.typography.fontSize * (height / 100);
}

export function galleryMaxLines(name: GalleryTemplateName): number {
  return templateEntry(name).json.lineSplitter.maxLines;
}

export function galleryEffects(name: GalleryTemplateName): Effect[] {
  const out: Effect[] = [];
  // Effects are optional per template (e.g. zara omits them entirely).
  for (const effect of templateEntry(name).json.effects ?? []) {
    if (!effect.enabled) continue;
    if (effect.type === 'gap_free') out.push(new GapFreeEffect());
    else if (effect.type === 'smart_punctuation') out.push(new SmartPunctuationEffect());
    else if (effect.type === 'remove_punctuation') out.push(new RemovePunctuationEffect());
    else if (effect.type === 'carry_quotes') out.push(new CarryQuotesEffect());
    // Same preserved tags as the studio descriptor.
    else if (effect.type === 'smart_lowercase') out.push(new SmartLowercaseEffect(['entity']));
    // AI-picked emoji decorations attach during semantic tagging, not as a
    // document effect; pinned render docs carry none, so nothing to apply.
    else if (effect.type === 'emoji') continue;
    else throw new Error(`gallery-style: unknown effect ${effect.type}`);
  }
  return out;
}

export function gallerySegmentSplitter(name: GalleryTemplateName): SegmentSplitter {
  const parts: SegmentSplitter[] = [];
  for (const splitter of templateEntry(name).json.segmentSplitters) {
    if (splitter.type === 'boundary') {
      parts.push(new BoundarySegmentSplitter({
        separators: [...(PRESET_SEPARATORS[splitter.mode ?? 'sentence'] ?? PRESET_SEPARATORS['sentence']!)],
      }));
    } else if (splitter.type === 'boundary_score_limit_by_chars') {
      parts.push(new BoundaryScoreLimitByCharsSegmentSplitter({
        maxChars: splitter.maxChars ?? 40,
        minChars: splitter.minChars ?? SCORE_MIN_CHARS_DEFAULT,
      }));
    } else if (splitter.type === 'limit_by_words') {
      parts.push(new LimitByWordsSegmentSplitter({ maxWords: (splitter as { maxWords?: number }).maxWords ?? 1 }));
    } else {
      throw new Error(`gallery-style: unknown splitter ${splitter.type}`);
    }
  }
  return new CompositeSegmentSplitter(parts);
}

export function galleryUsesSvgFilter(name: GalleryTemplateName): boolean {
  return /filter\s*:[^;]*url\(#/.test(templateEntry(name).css);
}

/** Default outline thickness (em) behind -webkit-text-stroke rules. */
export function galleryOutlineThickness(name: GalleryTemplateName): number {
  const { json } = templateEntry(name);
  for (const control of json.styleControls) {
    if (control.id === 'outline-thickness') return Number(control.default ?? 0);
  }
  return 0;
}

/**
 * Templates whose paint-order:stroke-fill text needs the layered model in
 * Takumi: the engine ignores paint-order and draws the stroke OVER the
 * fill, eating ~80% of thin glyphs (proven by probe: 3321 white px without
 * stroke vs 641 with). The outline copy paints the authored stroke over
 * transparent ink, the fill copy paints intact text without stroke —
 * exactly the browser's stroke-under-fill. Gated on a nonzero default
 * thickness so zero-outline templates keep the single fast path.
 */
export function galleryNeedsStrokeLayers(name: GalleryTemplateName): boolean {
  if (!/paint-order\s*:\s*stroke/.test(templateEntry(name).css)) return false;
  return galleryOutlineThickness(name) !== 0;
}

/** Takumi-only layered stroke CSS, appended AFTER the template stylesheet. */
export function galleryStrokeLayerCss(name: GalleryTemplateName): string {
  if (!galleryNeedsStrokeLayers(name)) return '';
  return [
    '.tscaps-takumi-outline span{color:transparent !important;text-shadow:none !important;}',
    '.tscaps-takumi-fill span{-webkit-text-stroke:0 !important;}',
  ].join('');
}

/**
 * Whether the stylesheet paints text through `background-clip: text`
 * (transparent ink showing a gradient). Takumi drops such text entirely
 * whenever the gradient is non-trivial (calc() angles) or nested past a
 * plain child run — proven by probe, not assumed. The fallback below
 * flattens it; the browser path never sees it.
 */
export function galleryUsesClipText(name: GalleryTemplateName): boolean {
  return /background-clip\s*:\s*text/.test(templateEntry(name).css);
}

/**
 * Takumi-only flattening for gradient-clipped text: every rule that clips
 * its background to the text keeps layout, keeps animations, but paints
 * the gradient's first stop as a solid color. The sheen is lost;
 * visibility, position, timing, and font survive. Browser path untouched.
 */
export function galleryClipTextFallback(name: GalleryTemplateName): string {
  const { css } = templateEntry(name);
  if (!galleryUsesClipText(name)) return '';
  // Protect @keyframes blocks (nested braces) from the rule splitter.
  const kept: string[] = [];
  const withoutKeyframes = css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, (m) => {
    kept.push(m);
    return `\0${kept.length - 1}\0`;
  });
  const out = withoutKeyframes.split('}').map((rule) => {
    if (!/background-clip\s*:\s*text/.test(rule)) return `${rule}}`;
    const first = firstGradientStop(rule);
    let fixed = rule
      .replace(/(-webkit-)?background-clip\s*:[^;]+;/g, '')
      .replace(/background-image\s*:[^;]+;/g, 'background-image:none;');
    if (first !== null) fixed = fixed.replace(/color\s*:\s*transparent\s*;/g, `color:${first};`);
    return `${fixed}}`;
  }).join('');
  return out.replace(/\0(\d+)\0/g, (_, i: string) => kept[Number(i)] ?? '');
}

/** First color token of the first gradient function in the rule, if any. */
function firstGradientStop(rule: string): string | null {
  const m = /(linear|radial|conic)-gradient\s*\(/g.exec(rule);
  if (!m || m.index === undefined) return null;
  let depth = 0;
  let inner = '';
  for (let i = m.index + m[0].length; i < rule.length; i++) {
    const ch = rule[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
    inner += ch;
  }
  const color = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/.exec(inner);
  return color ? color[0] : null;
}

/**
 * Takumi-only fallback CSS, appended AFTER the template stylesheet for the
 * layered outline model (engine `layeredOutline: true`): the outline copy
 * paints hollow stroked text, the fill copy paints intact text on top —
 * exactly the SVG `dilate + merge` structure. The browser path never sees it.
 *
 * feMorphology dilate grows the alpha OUTWARD by radius r; a CSS stroke
 * straddles the edge, so the outline copy uses width 2r — its inner half
 * hides under the fill copy, leaving r outside. Derived, not tuned.
 */
/** Studio-exact control serialization (see ControlValueCssRenderer): numbers
 * carry their declared unit, selects resolve cssValue, text is quoted,
 * fonts resolve to a quoted stack. The fallback-math loop below intentionally
 * keeps raw numbers instead. */
function renderControlValue(control: {
  type?: string; default: unknown; valueOn?: string; valueOff?: string;
  unit?: string; options?: ReadonlyArray<{ value: unknown; cssValue?: string }>;
}): string {
  const def = control.default;
  if (control.type === 'toggle') return def ? (control.valueOn ?? '1') : (control.valueOff ?? '0');
  if (control.type === 'select') {
    return control.options?.find((o) => o.value === def)?.cssValue ?? String(def);
  }
  if (control.type === 'text') return `"${String(def ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (control.type === 'font') {
    const fam = String(def ?? '');
    const short = fam.endsWith(' Variable') ? fam.slice(0, -' Variable'.length) : fam;
    // Same quoting the typography stack uses; stand-ins omitted (families
    // we do not ship would fall through to system anyway).
    return short === 'JetBrains Mono' ? '"JetBrains Mono", monospace' : `"${short}", sans-serif`;
  }
  if (typeof def === 'number' && control.unit) return `${def}${control.unit}`;
  return String(def ?? '');
}

export function galleryTakumiFallbackCss(name: GalleryTemplateName, fontPx: number): string {
  const { json } = templateEntry(name);
  if (!galleryUsesSvgFilter(name)) return '';
  const controls = new Map<string, string>();
  for (const control of json.styleControls) {
    if (control.type === 'toggle') {
      const on = String(control.default) === 'true';
      controls.set(control.id, on ? (control.valueOn ?? '') : (control.valueOff ?? ''));
    } else {
      controls.set(control.id, String(control.default));
    }
  }
  const outlineColor = controls.get('outline-color') || '#000000';
  // Filter vars are em by construction: the SVG markup appends the unit
  // itself (radius="var(--tscaps-outline-thickness, 0.125)em"), so the raw
  // control numbers always multiply by the font size.
  const dilatePx = Number(controls.get('outline-thickness') || '0') * fontPx;
  const thicknessPx = 2 * dilatePx;
  const shadowColor = controls.get('shadow-color') || '#000000';
  const shadowDistance = Number(controls.get('filter-shadow-distance') || '0') * fontPx;
  const shadowBlur = Number(controls.get('filter-shadow-blur') || '0') * fontPx;
  return [
    '.segment{filter:none;}',
    `.tscaps-takumi-outline span{color:transparent !important;-webkit-text-stroke:${thicknessPx.toFixed(2)}px ${outlineColor};}`,
    shadowDistance > 0 || shadowBlur > 0
      ? `.tscaps-takumi-outline{filter:drop-shadow(${shadowDistance.toFixed(2)}px ${shadowDistance.toFixed(2)}px ${shadowBlur.toFixed(2)}px ${shadowColor});}`
      : '',
  ].join('');
}

// Builds the template as shipped (first variant defaults), with
// container-query units pre-resolved to px at the render size. The browser
// resolves cqh/cqw against its subtitle container (the full frame here);
// Takumi has no container context, so the same arithmetic happens up front:
// cqh = height/100, cqw = width/100.
//
// With opts.takumi, the style is baked for Takumi instead of the browser:
// SVG-filter outlines become layered vector strokes, gradient-clipped text
// (which Takumi drops) flattens to its first stop, and a wanted italic in
// a family without an italic face pins to normal (Takumi cannot
// faux-italicize like browsers do). One function owns every Takumi/browser
// divergence so the two can never drift apart unnoticed.
export function buildGalleryStyle(
  name: GalleryTemplateName,
  width: number,
  height: number,
  opts?: { takumi?: boolean; hasItalic?: boolean },
): SubtitleStyle {
  const takumi = opts?.takumi ?? false;
  const hasItalic = opts?.hasItalic ?? true;
  const { json, css: rawCss, filters } = templateEntry(name);
  const cqh = height / 100;
  const cqw = width / 100;
  const px = (value: string): string =>
    value
      .replace(/([\d.]+)cqh/g, (_, n: string) => `${(Number(n) * cqh).toFixed(2)}px`)
      .replace(/([\d.]+)cqw/g, (_, n: string) => `${(Number(n) * cqw).toFixed(2)}px`);
  const controls = new Map<string, string>();
  for (const control of json.styleControls) {
    const value = renderControlValue(control);
    if (value !== '') controls.set(control.id, px(value));
  }
  const inlineStyles: Record<string, string> = {};
  for (const [id, value] of controls) {
    inlineStyles[`--tscaps-${id}`] = value;
  }
  const typo = json.typography;
  inlineStyles['--tscaps-font-family'] = galleryFontFamilyCss(name);
  inlineStyles['--tscaps-font-weight'] = String(typo.fontWeight);
  inlineStyles['--tscaps-font-size'] = `${(typo.fontSize * cqh).toFixed(2)}px`;
  inlineStyles['--tscaps-letter-spacing'] = `${typo.letterSpacing}em`;
  inlineStyles['--tscaps-word-spacing'] = `${typo.wordSpacing}em`;
  // text-align:start paints left in ltr; spell it out for engines without
  // logical values. Templates that omit textAlign keep the CSS fallback.
  if (typo.textAlign !== undefined) {
    inlineStyles['--tscaps-text-align'] = typo.textAlign === 'start' ? 'left' : typo.textAlign;
  }
  if (typo.textCase !== undefined) inlineStyles['--tscaps-text-transform'] = typo.textCase;
  // The template's italic flag, when present, is authoritative — except for
  // Takumi in a family without an italic face (see above).
  if (typo.italic === true) {
    inlineStyles['--tscaps-font-style'] = takumi && !hasItalic ? 'normal' : 'italic';
  }
  const fontPx = typo.fontSize * cqh;
  // Takumi cannot evaluate max()/min() at all (proven by probe: every
  // max/min form renders at content size, e.g. nyx min-width collapsing
  // 320px to 77px), so fold the statically known ones at bake time. Only
  // control-driven vars with px-literal fallbacks substitute their baked
  // value; engine timing vars (--on-*, --segment-*, ...) and
  // template-internal vars have unitless fallbacks or aren't controls, so
  // live recipes like --tscaps-font-size-scale survive untouched for the
  // renderer's JS handling.
  const pxLit = /^-?[\d.]+px$/;
  const foldMaxMin = (cssText: string): string => {
    let prev = '';
    let out = cssText;
    for (let i = 0; i < 5 && out !== prev; i++) {
      prev = out;
      out = out.replace(/\b(m(?:ax|in))\(((?:[^()]|\([^()]*\))*)\)/g, (m, fn: string, args: string) => {
        // Top-level comma split (var() fallbacks contain commas).
        const parts: string[] = [];
        let depth = 0;
        let cur = '';
        for (const ch of args) {
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
          if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
        }
        parts.push(cur.trim());
        const resolved = parts.map((a) => a.replace(
          /var\((--[\w-]+),\s*(-?[\d.]+px)\)/g,
          (vm: string, vname: string) => {
            const id = vname.replace(/^--tscaps-/, '');
            const bakedVal = inlineStyles[vname];
            return controls.has(id) && bakedVal !== undefined && pxLit.test(bakedVal) ? bakedVal : vm;
          },
        ));
        if (!resolved.every((p) => pxLit.test(p))) return m;
        const nums = resolved.map((p) => Number(p.slice(0, -2)));
        const v = fn === 'max' ? Math.max(...nums) : Math.min(...nums);
        return `${Number(v.toFixed(2))}px`;
      });
    }
    return out;
  };
  // Ivo is the only gallery template that shrink-fits its lines with
  // `display:table`. Takumi resolves an auto-width table to min-content
  // (one word per line, proven by probe: 182px lines vs the browser's
  // 564px), which both wrecks the geometry and pushes the caption past
  // the viewport edge so the accent line gets clipped. A block with
  // max-content width plus the template's own `margin:0 auto` centers
  // identically in both engines.
  const tableFix = takumi && name === 'ivo'
    ? '\n.line{display:block;width:max-content;max-width:100%;}'
    : '';
  // Pepper's narrated-word pill is an absolutely-positioned ::before with
  // empty content — two things Takumi drops (proven by probe: empty
  // content generates no box at all, and absolute pseudos never paint).
  // Same visual as a box-shadow spread: it expands around the word without
  // touching layout at all, which matters because Takumi ADDS the absolute
  // value of negative margins to boxes (proven: -10px margins widen by
  // +40px), so the padding-plus-negative-margin equivalent is unusable.
  // Radius follows the shadow; template vars reused so controls work.
  // The 0.16s grow pop and the few px of vertical padding mismatch are
  // lost; steady states match.
  const pillFix = takumi && name === 'pepper'
    ? '\n.word-being-narrated{box-shadow:0 0 0 var(--tscaps-highlight-bg-padding-x, 0.2em) var(--tscaps-highlight-bg-color, #cb5a2a);border-radius:var(--tscaps-highlight-bg-radius, 0.16em);}\n.word-being-narrated::before{display:none;}'
    : '';
  const baked = takumi
    ? foldMaxMin(`${px(rawCss)}\n${galleryTakumiFallbackCss(name, fontPx)}\n${galleryClipTextFallback(name)}${galleryStrokeLayerCss(name)}${tableFix}${pillFix}`).replace(
      /(\banimation\s*:[^;}]*?)\bboth\b/g,
      // Ended `both`-fill animations break descendant box painting in
      // Takumi (proven by probe: accent backgrounds vanish while text
      // survives). `backwards` keeps pre-start behavior identical, and
      // gallery entrances rest at base styles so post-end output is
      // identical too. Infinite animations never end and are unaffected.
      '$1backwards',
    )
    : px(rawCss);
  return {
    css: baked,
    inlineStyles,
    alignment: {
      verticalAlign: json.alignment.verticalAlign,
      verticalOffset: json.alignment.verticalOffset,
      horizontalAlign: json.alignment.horizontalAlign ?? 'center',
      horizontalOffset: json.alignment.horizontalOffset ?? 0.5,
    },
    rendering: {
      splitWordsIntoLetters: json.rendering?.splitWordsIntoLetters ?? false,
      videoFrame: json.rendering?.videoFrame?.required === true
        ? { required: true as const, jpegQuality: json.rendering.videoFrame.jpegQuality ?? 0.8 }
        : { required: false as const, jpegQuality: 1 },
      padding: null,
      textDirection: 'ltr',
    },
    // Real filter bodies for the browser path (Takumi ignores svgFilters
    // and uses galleryTakumiFallbackCss instead). Raw control values: the
    // engine's length resolver converts em/cqh at render time.
    ...(filters === null ? {} : { svgFilters: buildFilterBundle(filters, controls, galleryFontPxFromTypo(typo, height), height) }),
  };
}

function galleryFontPxFromTypo(typo: TemplateJson['typography'], height: number): number {
  return typo.fontSize * (height / 100);
}

function buildFilterBundle(filtersSvg: string, controls: Map<string, string>, fontPx: number, height: number): SvgFilterBundle {
  const definitions = new SvgFilterDefinitionsParser().parse(filtersSvg);
  const entries: Array<readonly [string, string]> = [...controls].map(
    ([id, value]) => [`--tscaps-${id}`, value] as const,
  );
  const scope = SvgFilterScope.fromEntries(entries);
  return new SvgFilterBundle(definitions, {
    scopeAt: () => scope,
    lengthFactorsAt: () => ({ pxPerEm: fontPx, pxPerCqh: height / 100 }),
  });
}
