import {
  CompositeSegmentSplitter,
  BoundarySegmentSplitter,
  BoundaryScoreLimitByCharsSegmentSplitter,
  GapFreeEffect,
  SmartPunctuationEffect,
  RemovePunctuationEffect,
  SvgFilterDefinitionsParser,
  SvgFilterBundle,
  SvgFilterScope,
  type Effect,
  type SegmentSplitter,
  type SubtitleStyle,
} from '@tscaps/engine';
import picoTemplate from '../../../../templates/pico/template.json';
import picoCss from '../../../../templates/pico/style.build.css?raw';
import lokiTemplate from '../../../../templates/loki/template.json';
import lokiCss from '../../../../templates/loki/style.build.css?raw';
import lokiFilters from '../../../../templates/loki/filters.build.svg?raw';

export type GalleryTemplateName = 'pico' | 'loki';

interface TemplateJson {
  typography: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    letterSpacing: number;
    wordSpacing: number;
    textAlign?: string;
    textCase?: string;
  };
  rendering?: { splitWordsIntoLetters?: boolean };
  styleControls: ReadonlyArray<{
    id: string; type?: string; default: unknown; valueOn?: string; valueOff?: string;
  }>;
  segmentSplitters: ReadonlyArray<{
    type: string; mode?: string; maxChars?: number; minChars?: number;
  }>;
  lineSplitter: { type: string; maxLines: number };
  alignment: { verticalAlign: 'top' | 'center' | 'bottom'; verticalOffset: number };
  effects: ReadonlyArray<{ type: string; enabled: boolean }>;
}

const TEMPLATES: Record<GalleryTemplateName, { json: TemplateJson; css: string; filters: string | null }> = {
  pico: { json: picoTemplate as unknown as TemplateJson, css: picoCss, filters: null },
  loki: { json: lokiTemplate as unknown as TemplateJson, css: lokiCss, filters: lokiFilters },
};

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

/** Font family the CSS must name for Takumi to hit the loaded font. */
export function galleryFontFamilyCss(name: GalleryTemplateName): string {
  return name === 'pico' ? '"JetBrains Mono", monospace' : '"Komika Axis", sans-serif';
}

/** Display family (matches the loaded font's registered name). */
export function galleryFontFamily(name: GalleryTemplateName): string {
  return name === 'pico' ? 'JetBrains Mono' : 'Komika Axis';
}

/** Resolved display font size in px at the render height. */
export function galleryFontPx(name: GalleryTemplateName, height: number): number {
  return TEMPLATES[name].json.typography.fontSize * (height / 100);
}

/**
 * Whether the template draws through `filter: url(#id)` SVG filters.
 * Takumi cannot run those; such templates need the layered outline
 * (hollow stroked copy under the intact fill) plus the fallback below.
 */
export function galleryUsesSvgFilter(name: GalleryTemplateName): boolean {
  return /filter\s*:[^;]*url\(#/.test(TEMPLATES[name].css);
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
export function galleryTakumiFallbackCss(name: GalleryTemplateName, fontPx: number): string {
  const { json } = TEMPLATES[name];
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
  // feMorphology dilate grows the alpha OUTWARD by radius r. A CSS stroke
  // straddles the edge (half in, half out), so the exact equivalent width
  // is 2r with the fill repainted on top via paint-order. No tuning knob:
  // this is derived from the template, not chosen.
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

export function galleryMaxLines(name: GalleryTemplateName): number {
  return TEMPLATES[name].json.lineSplitter.maxLines;
}

export function galleryEffects(name: GalleryTemplateName): Effect[] {
  const out: Effect[] = [];
  for (const effect of TEMPLATES[name].json.effects) {
    if (!effect.enabled) continue;
    if (effect.type === 'gap_free') out.push(new GapFreeEffect());
    else if (effect.type === 'smart_punctuation') out.push(new SmartPunctuationEffect());
    else if (effect.type === 'remove_punctuation') out.push(new RemovePunctuationEffect());
    else throw new Error(`gallery-style: unknown effect ${effect.type}`);
  }
  return out;
}

export function gallerySegmentSplitter(name: GalleryTemplateName): SegmentSplitter {
  const parts: SegmentSplitter[] = [];
  for (const splitter of TEMPLATES[name].json.segmentSplitters) {
    if (splitter.type === 'boundary') {
      parts.push(new BoundarySegmentSplitter({
        separators: [...(PRESET_SEPARATORS[splitter.mode ?? 'sentence'] ?? PRESET_SEPARATORS['sentence']!)] ,
      }));
    } else if (splitter.type === 'boundary_score_limit_by_chars') {
      parts.push(new BoundaryScoreLimitByCharsSegmentSplitter({
        maxChars: splitter.maxChars ?? 40,
        minChars: splitter.minChars ?? SCORE_MIN_CHARS_DEFAULT,
      }));
    } else {
      throw new Error(`gallery-style: unknown splitter ${splitter.type}`);
    }
  }
  return new CompositeSegmentSplitter(parts);
}

// Builds the template as shipped (first variant defaults), with
// container-query units pre-resolved to px at the render size. The browser
// resolves cqh/cqw against its subtitle container (the full frame here);
// Takumi has no container context, so the same arithmetic happens up front:
// cqh = height/100, cqw = width/100.
export function buildGalleryStyle(name: GalleryTemplateName, width: number, height: number): SubtitleStyle {
  const { json, css: rawCss, filters } = TEMPLATES[name];
  const cqh = height / 100;
  const cqw = width / 100;
  const px = (value: string): string =>
    value
      .replace(/([\d.]+)cqh/g, (_, n: string) => `${(Number(n) * cqh).toFixed(2)}px`)
      .replace(/([\d.]+)cqw/g, (_, n: string) => `${(Number(n) * cqw).toFixed(2)}px`);
  const controls = new Map<string, string>();
  for (const control of json.styleControls) {
    if (control.type === 'toggle') {
      const on = String(control.default) === 'true';
      controls.set(control.id, on ? (control.valueOn ?? '') : (control.valueOff ?? ''));
    } else {
      controls.set(control.id, String(control.default));
    }
  }
  const inlineStyles: Record<string, string> = {};
  for (const [id, value] of controls) {
    if (value !== '') inlineStyles[`--tscaps-${id}`] = px(value);
  }
  const typo = json.typography;
  inlineStyles['--tscaps-font-family'] = galleryFontFamilyCss(name);
  inlineStyles['--tscaps-font-weight'] = String(typo.fontWeight);
  inlineStyles['--tscaps-font-size'] = `${(typo.fontSize * cqh).toFixed(2)}px`;
  inlineStyles['--tscaps-letter-spacing'] = `${typo.letterSpacing}em`;
  inlineStyles['--tscaps-word-spacing'] = `${typo.wordSpacing}em`;
  // text-align:start paints left in ltr; spell it out for engines without
  // logical values. Loki omits textAlign and keeps the CSS fallback.
  if (typo.textAlign !== undefined) {
    inlineStyles['--tscaps-text-align'] = typo.textAlign === 'start' ? 'left' : typo.textAlign;
  }
  if (typo.textCase !== undefined) inlineStyles['--tscaps-text-transform'] = typo.textCase;
  return {
    css: px(rawCss),
    inlineStyles,
    alignment: {
      verticalAlign: json.alignment.verticalAlign,
      verticalOffset: json.alignment.verticalOffset,
      horizontalAlign: 'center',
      horizontalOffset: 0.5,
    },
    rendering: {
      splitWordsIntoLetters: json.rendering?.splitWordsIntoLetters ?? false,
      videoFrame: { required: false, jpegQuality: 1 },
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
