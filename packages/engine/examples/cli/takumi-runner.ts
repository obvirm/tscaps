import {
  RenderPipelineBuilder,
  TakumiSubtitleFrameRenderer,
  Document,
  Section,
  Segment,
  Line,
  Word,
  Tag,
  TimeFragment,
  type PipelineProgressEvent,
  type TakumiRenderFn,
  type TakumiBitmapDecoder,
} from '@tscaps/engine';
import { render } from 'takumi-js';
import { buildGalleryStyle, gallerySegmentSplitter, galleryEffects, galleryMaxLines, galleryFontFamily, galleryFontPx, galleryTakumiFallbackCss, galleryUsesSvgFilter, galleryTemplateNames, galleryTemplateJson, type GalleryTemplateName } from './gallery-style';

export type RunnerStyle = 'default' | GalleryTemplateName;

declare global {
  interface Window {
    renderE2E(videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: RunnerStyle): Promise<void>;
    transcribeOnly(videoUrl: string, style: RunnerStyle): Promise<DocJson>;
    renderFromDocument(videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: RunnerStyle, doc: DocJson): Promise<void>;
    takumiProbe(): Promise<number>;
    picoProbe(): Promise<{ bytes: number; magic: string; data: number[] }>;
    picoSweep(): Promise<{ failures: string[]; data: number[] }>;
    matrixNames(): string[];
    matrixCase(name: string, t: number): Promise<MatrixCaseResult>;
    matrixCase(name: string, t: number): Promise<MatrixCaseResult>;
    layeredProbe(fontBytes: number[]): Promise<number[]>;
    fontOutlineProbe(fontBytes: number[]): Promise<Record<string, number[]>>;
    fontFirstProbe(fontBytes: number[]): Promise<Record<string, number[]>>;
    lokiTextProbe(fontBytes: number[], lines: string[]): Promise<Record<string, number[]>>;
    outlineVariantsProbe(fontBytes: number[]): Promise<Record<string, number[]>>;
    cssIsolateProbe(fontBytes: number[]): Promise<Record<string, number[]>>;
  }
}

// JSON form of the post-effects Document: the exact render input, so two
// renders can share one transcription byte-for-byte. Without pinning,
// independent Whisper runs differ in words/timings and pollute any
// renderer comparison with transcription variance.
interface DocJson {
  sections: ReadonlyArray<{
    kind: string;
    segments: ReadonlyArray<{
      customTime: { s: number; e: number } | null;
      effectTime: { s: number; e: number } | null;
      structureTags: ReadonlyArray<string>;
      lines: ReadonlyArray<{
        structureTags: ReadonlyArray<string>;
        words: ReadonlyArray<{
          text: string;
          displayText: string;
          s: number; e: number;
          structureTags: ReadonlyArray<string>;
          semanticTags: ReadonlyArray<string>;
        }>;
      }>;
    }>;
  }>;
}

function timeOrNull(t: { start: number; end: number } | null): { s: number; e: number } | null {
  return t === null ? null : { s: t.start, e: t.end };
}

function serializeDocument(doc: Document): DocJson {
  return {
    sections: doc.sections.map((section) => ({
      kind: section.kind,
      segments: section.segments.map((seg) => ({
        customTime: timeOrNull(seg.customTime),
        effectTime: timeOrNull(seg.effectTime),
        structureTags: [...seg.structureTags].map((t) => t.name),
        lines: seg.lines.map((line) => ({
          structureTags: [...line.structureTags].map((t) => t.name),
          words: line.words.map((word) => ({
            text: word.text,
            displayText: word.displayText,
            s: word.time.start,
            e: word.time.end,
            structureTags: [...word.structureTags].map((t) => t.name),
            semanticTags: [...word.semanticTags].map((t) => t.name),
          })),
        })),
      })),
    })),
  };
}

function rebuildDocument(json: DocJson): Document {
  const frag = (t: { s: number; e: number } | null): TimeFragment | undefined =>
    t === null ? undefined : new TimeFragment(t.s, t.e);
  const sections = json.sections.map((section) => {
    const segments = section.segments.map((seg) => {
      const lines = seg.lines.map((line) => {
        const words = line.words.map((word) => new Word({
          text: word.text,
          displayText: word.displayText,
          time: new TimeFragment(word.s, word.e),
          structureTags: new Set(word.structureTags.map((n) => new Tag(n))),
          semanticTags: new Set(word.semanticTags.map((n) => new Tag(n))),
        }));
        return new Line({
          structureTags: new Set(line.structureTags.map((n) => new Tag(n))),
          words,
        });
      });
      return new Segment({
        lines,
        structureTags: new Set(seg.structureTags.map((n) => new Tag(n))),
        customTime: frag(seg.customTime) ?? null,
        effectTime: frag(seg.effectTime) ?? null,
      });
    });
    return new Section({ kind: section.kind, segments });
  });
  return new Document({ sections });
}

function buildPipeline(video: Blob, style: RunnerStyle, probe: { width: number; height: number }, takumi: boolean) {
  const builder = new RenderPipelineBuilder().withInputVideo(video);
  if (style !== 'default') {
    const base = buildGalleryStyle(style, probe.width, probe.height);
    // The fallback re-expresses SVG-filter outlines as vector strokes for
    // Takumi only; the browser path keeps the pure template stylesheet.
    const css = takumi
      ? `${base.css}\n${galleryTakumiFallbackCss(style, galleryFontPx(style, probe.height))}`
      : base.css;
    builder
      .withSubtitleStyle({ ...base, css })
      .withSegmentSplitter(gallerySegmentSplitter(style))
      .withDefaultLineSplitterConfig({ maxLines: galleryMaxLines(style), minLines: 1, maxWidthRatio: 0.72 })
      .withEffects(galleryEffects(style));
  }
  return builder;
}

async function loadDocumentFont(fontUrl: string | null, style: RunnerStyle): Promise<void> {
  // The browser renderer paints with page fonts: without this the baseline
  // silently falls back and stops being a reference. Takumi ignores it.
  if (fontUrl === null || style === 'default') return;
  const face = new FontFace(galleryFontFamily(style), `url(${fontUrl})`);
  await face.load();
  document.fonts.add(face);
}

// Full stock pipeline on a real video. The ONLY seam under experiment is
// the subtitle frame renderer: Takumi versus the stock browser renderer.
// Transcription (Whisper bawaan), splitting, tagging, effects, compositing,
// and muxing are identical in both runs. Pico applies the real gallery
// template (template.json controls + compiled CSS + JetBrains Mono),
// resolved at the render size exactly as the browser would compute it.
window.renderE2E = async (videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: RunnerStyle) => {
  const inputBlob = await (await fetch(videoUrl)).blob();
  const probe = await probeDimensions(inputBlob);
  await loadDocumentFont(fontUrl, style);
  const takumi = renderer === 'takumi';
  const builder = buildPipeline(inputBlob, style, probe, takumi);

  if (takumi) {
    const { fonts, decode } = await adapterFonts(fontUrl, style);
    builder.withSubtitleFrameRenderer(new TakumiSubtitleFrameRenderer(takumiAdapter(), {
      ...(fonts === undefined ? {} : { fonts }),
      decode,
      layeredOutline: style !== 'default' && galleryUsesSvgFilter(style),
    }));
  }
  const pipeline = builder.build();
  const result = await pipeline.run((event) => console.log(describeProgressEvent(event)));
  if (result.blob === null) throw new Error('Pipeline returned no blob');
  triggerBrowserDownload(result.blob, `output-${renderer}-${style}.mp4`);
};

// Transcribe + split + tag + effects only; returns the exact render input
// so later renders can pin it.
window.transcribeOnly = async (videoUrl: string, style: RunnerStyle) => {
  const inputBlob = await (await fetch(videoUrl)).blob();
  const probe = await probeDimensions(inputBlob);
  const builder = buildPipeline(inputBlob, style, probe, false);
  const pipeline = builder.build();
  const onProgress = (event: PipelineProgressEvent) => console.log(describeProgressEvent(event));
  await pipeline.runTranscriptionStep(onProgress);
  await pipeline.runSplittingStep(onProgress);
  pipeline.runStructuralTaggingStep(onProgress);
  await pipeline.runSemanticTaggingStep(onProgress);
  pipeline.runEffectsStep(onProgress);
  const doc = pipeline.getDocument();
  if (!doc) throw new Error('No document after pipeline steps');
  return serializeDocument(doc);
};

// Render a pinned document: identical bytes in, identical captions out,
// whichever renderer paints them.
window.renderFromDocument = async (videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: RunnerStyle, doc: DocJson) => {
  const inputBlob = await (await fetch(videoUrl)).blob();
  const probe = await probeDimensions(inputBlob);
  await loadDocumentFont(fontUrl, style);
  const takumi = renderer === 'takumi';
  const builder = buildPipeline(inputBlob, style, probe, takumi);
  if (takumi) {
    const { fonts, decode } = await adapterFonts(fontUrl, style);
    builder.withSubtitleFrameRenderer(new TakumiSubtitleFrameRenderer(takumiAdapter(), {
      ...(fonts === undefined ? {} : { fonts }),
      decode,
      layeredOutline: style !== 'default' && galleryUsesSvgFilter(style),
    }));
  }
  const pipeline = builder.build();
  pipeline.setDocument(rebuildDocument(doc));
  const result = await pipeline.runRenderingStep((event) => console.log(describeProgressEvent(event)));
  if (result.blob === null) throw new Error('Pipeline returned no blob');
  triggerBrowserDownload(result.blob, `output-${renderer}-${style}-pinned.mp4`);
};

function takumiAdapter(): TakumiRenderFn {
  // Adapter: engine's injectable signature over takumi-js's union options.
  // Validates PNG magic so a corrupt/empty backend output fails loud with
  // its timestamp instead of dying later inside createImageBitmap.
  return async (node, options) => {
    const out = await render(node, {
      width: options.width,
      height: options.height,
      css: [...options.css],
      timeMs: options.timeMs,
      ...(options.fonts !== undefined ? { fonts: options.fonts as never[] } : {}),
    });
    const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    const isPng = bytes.length > 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!isPng) {
      throw new Error(
        `Takumi returned ${bytes.length} non-PNG bytes at timeMs=${options.timeMs} (node ${node.length} chars)`,
      );
    }
    return bytes;
  };
}

async function adapterFonts(fontUrl: string | null, style: RunnerStyle) {
  // Local font bytes (served by the driver): no per-render CDN fetches.
  const fonts = fontUrl === null || style === 'default'
    ? undefined
    : [{ name: galleryFontFamily(style), data: new Uint8Array(await (await fetch(fontUrl)).arrayBuffer()) }];
  const decode: TakumiBitmapDecoder = async (png) => {
    const blob = new Blob([png as unknown as BlobPart], { type: 'image/png' });
    try {
      return await createImageBitmap(blob);
    } catch (err) {
      const magic = [...png.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
      throw new Error(`decode failed: ${png.length} bytes, magic ${magic}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  return { ...(fonts === undefined ? {} : { fonts }), decode };
}

// One Pico frame through the style path (built-in font; network-free).
window.picoProbe = async () => {
  const style = buildGalleryStyle('pico', 720, 1280);
  const node = `<div class="tscaps-takumi-root"><div class="tscaps-takumi-caption"><div class="segment"><div class="line"><span class="word">Uji</span> <span class="word">coba</span></div></div></div></div>`;
  const png = await render(node, {
    width: 720,
    height: 1280,
    css: ['.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:flex-end;background:transparent;}', style.css],
    timeMs: 1000,
  });
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
  const magic = [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
  return { bytes: bytes.length, magic, data: [...bytes] };
};
window.takumiProbe = async () => {
  const png = await render(`<div style="width:100%;height:100%;background:transparent;"><span>smoke</span></div>`, {
    width: 64,
    height: 64,
    css: ['span{color:#fff;font-size:20px;}'],
  });
  return png.length;
};

// Edge-case sweep through the REAL renderer: letters, empty text,
// zero-duration words, multi-line, multi-section. Reports failures.
window.picoSweep = async () => {
  const style = buildGalleryStyle('pico', 720, 1280);
  let lastBytes: Uint8Array = new Uint8Array();
  const takumiRender: TakumiRenderFn = async (node, options) => {
    const out = await render(node, {
      width: options.width,
      height: options.height,
      css: [...options.css],
      timeMs: options.timeMs,
      ...(options.fonts !== undefined ? { fonts: options.fonts as never[] } : {}),
    });
    lastBytes = out instanceof Uint8Array ? out : new Uint8Array(out);
    return lastBytes;
  };
  const w = (text: string, s: number, e: number) => new Word({ text, time: new TimeFragment(s, e) });
  const doc = new Document({
    sections: [
      new Section({
        kind: 'pico',
        segments: [
          new Segment({ lines: [new Line({ words: [w('Hello', 0, 1), w('world', 1, 2)] })], customTime: new TimeFragment(0, 2) }),
          new Segment({ lines: [new Line({ words: [w('', 2, 3)] })], customTime: new TimeFragment(2, 3) }),
          new Segment({ lines: [new Line({ words: [w('instan', 3, 3)] })], customTime: new TimeFragment(3, 4) }),
          new Segment({
            lines: [
              new Line({ words: [w('baris', 4, 5), w('satu', 5, 6)] }),
              new Line({ words: [w('baris & dua <tiga>', 4, 6)] }),
            ],
            customTime: new TimeFragment(4, 6),
          }),
        ],
      }),
      new Section({
        kind: 'pico',
        segments: [
          new Segment({ lines: [new Line({ words: [w('overlap', 5, 9)] })], customTime: new TimeFragment(5, 9) }),
        ],
      }),
    ],
  });
  const renderer = new TakumiSubtitleFrameRenderer(takumiRender);
  await renderer.open(doc, { pico: style }, 720, 1280);
  const failures: string[] = [];
  // Batched multi-timestamp calls, mirroring production parallelism.
  const stamps = [0, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 7, 10, 10.5, 11, 12.3, 45.678, 100.25, 131.8, 139.9];
  for (let i = 0; i < stamps.length; i += 8) {
    try {
      await renderer.getFrames(stamps.slice(i, i + 8));
    } catch (err) {
      failures.push(`batch@${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  renderer.close();
  return { failures, data: [...lastBytes] };
};

// Layered outline through the REAL renderer: hollow stroked copy under
// intact fill, Loki CSS + fallback. Returns one frame's PNG bytes.
window.layeredProbe = async (fontBytes: number[]) => {
  const style = buildGalleryStyle('loki', 720, 1280);
  const fallback = galleryTakumiFallbackCss('loki', galleryFontPx('loki', 1280));
  const fonts = [{ name: 'Komika Axis', data: new Uint8Array(fontBytes) }];
  let captured: Uint8Array = new Uint8Array();
  const takumiRender: TakumiRenderFn = async (node, options) => {
    const out = await render(node, {
      width: options.width,
      height: options.height,
      css: [...options.css],
      timeMs: options.timeMs,
      ...(options.fonts !== undefined ? { fonts: options.fonts as never[] } : {}),
    });
    captured = out instanceof Uint8Array ? out : new Uint8Array(out);
    return captured;
  };
  const w = (text: string, s: number, e: number) => new Word({ text, time: new TimeFragment(s, e) });
  const doc = new Document({
    sections: [new Section({
      kind: 'loki',
      segments: [new Segment({
        lines: [new Line({ words: [w('BUT', 0, 2), w('THE', 0, 2), w('DOOR', 0, 2)] })],
        customTime: new TimeFragment(0, 2),
      })],
    })],
  });
  const renderer = new TakumiSubtitleFrameRenderer(takumiRender, { fonts, layeredOutline: true });
  await renderer.open(doc, { loki: { ...style, css: `${style.css}\n${fallback}` } }, 720, 1280);
  await renderer.getFrames([0.5]);
  renderer.close();
  return [...captured];
};

// Isolates which markup/CSS breaks Komika matching. Each case with and
// without fonts; the with/without pair must differ iff the font applies.
window.cssIsolateProbe = async (fontBytes: number[]) => {
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const seg = (extra: string) => `.segment{font-family:"Komika Axis",sans-serif;font-size:58px;color:#fff;text-align:center;${extra}}`;
  const fonts = [{ name: 'Komika Axis', data: new Uint8Array(fontBytes) }];
  const cases: Record<string, { node: string; css: string }> = {
    separate: {
      node: `<div class="tscaps-takumi-root"><div class="segment"><span class="word">but</span> <span class="word">the</span> <span class="word">door</span></div></div>`,
      css: seg(''),
    },
    singlespan: {
      node: `<div class="tscaps-takumi-root"><div class="segment"><span class="word">but the door</span></div></div>`,
      css: seg(''),
    },
    upper: {
      node: `<div class="tscaps-takumi-root"><div class="segment"><span class="word">but</span> <span class="word">the</span> <span class="word">door</span></div></div>`,
      css: seg('text-transform:uppercase;'),
    },
    upperSingle: {
      node: `<div class="tscaps-takumi-root"><div class="segment"><span class="word">but the door</span></div></div>`,
      css: seg('text-transform:uppercase;'),
    },
  };
  const out: Record<string, number[]> = {};
  for (const [key, c] of Object.entries(cases)) {
    for (const withFonts of [false, true]) {
      const png = await render(c.node, {
        width: 720,
        height: 400,
        css: [root, c.css],
        ...(withFonts ? { fonts } : {}),
      });
      const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      out[`${key}-${withFonts ? 'withFont' : 'noFont'}`] = [...bytes];
    }
  }
  return out;
};
// Outline width/kind matrix on the real Loki line, Komika loaded.
// The user judges which matches the template's beast-outline best.
window.outlineVariantsProbe = async (fontBytes: number[]) => {
  const node = `<div class="tscaps-takumi-root"><div class="segment"><div class="line"><span class="word">BUT</span> <span class="word being-narrated">THE</span> <span class="word">DOOR</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:#222;}';
  const base = `.segment{font-family:"Komika Axis",sans-serif;font-size:57.6px;letter-spacing:0.02em;text-transform:uppercase;color:#fff;text-align:center;} .word{margin:0 0.16em;} .being-narrated{color:#ffea00;}`;
  const fonts = [{ name: 'Komika Axis', data: new Uint8Array(fontBytes) }];
  const variants: Record<string, string> = {
    none: base,
    stroke7: `${base} .word{-webkit-text-stroke:7.2px #000;paint-order:stroke fill;}`,
    stroke14: `${base} .word{-webkit-text-stroke:14.4px #000;paint-order:stroke fill;}`,
    stroke7fill: `${base} .word{-webkit-text-stroke:7.2px #000;paint-order:stroke fill markers;}`,
    hollow7: `${base} .word{color:transparent;-webkit-text-stroke:7.2px #000;}`,
    hollowFill: `${base} .word{-webkit-text-fill-color:transparent;-webkit-text-stroke:7.2px #000;}`,
  };
  const out: Record<string, number[]> = {};
  for (const [key, css] of Object.entries(variants)) {
    const png = await render(node, { width: 720, height: 400, css: [root, css], fonts });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};
window.lokiTextProbe = async (fontBytes: number[], lines: string[]) => {
  const inner = lines.map((l) => `<div class="line"><span class="word">${l}</span></div>`).join('');
  const node = `<div class="tscaps-takumi-root"><div class="segment">${inner}</div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const base = `.segment{font-family:"Komika Axis",sans-serif;font-size:57.6px;letter-spacing:0.02em;text-transform:uppercase;color:#fff;text-align:center;} .word{margin:0 0.16em;}`;
  const fonts = [{ name: 'Komika Axis', data: new Uint8Array(fontBytes) }];
  const out: Record<string, number[]> = {};
  for (const key of ['noFont', 'withFont']) {
    const png = await render(node, {
      width: 720,
      height: 400,
      css: [root, base],
      ...(key === 'noFont' ? {} : { fonts }),
    });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};

// Order test: Komika render FIRST in a fresh page, fallback second.
window.fontFirstProbe = async (fontBytes: number[]) => {
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const css = `.segment{font-family:"Komika Axis",sans-serif;font-size:58px;color:#fff;text-align:center;}`;
  const node = `<div class="tscaps-takumi-root"><div class="segment"><span class="word">but</span> <span class="word">the</span> <span class="word">door</span></div></div>`;
  const fonts = [{ name: 'Komika Axis', data: new Uint8Array(fontBytes) }];
  const out: Record<string, number[]> = {};
  for (const withFonts of [true, false]) {
    const png = await render(node, {
      width: 720,
      height: 400,
      css: [root, css],
      ...(withFonts ? { fonts } : {}),
    });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[withFonts ? 'first-withFont' : 'second-noFont'] = [...bytes];
  }
  return out;
};
// custom font, (b) Komika bytes, (c) Komika + -webkit-text-stroke,
// (d) Komika + stacked text-shadow. Returns PNG bytes per variant.
window.fontOutlineProbe = async (fontBytes: number[]) => {
  const node = `<div class="tscaps-takumi-root"><div class="segment"><div class="line"><span class="word">BUT</span> <span class="word being-narrated">THE</span> <span class="word">DOOR</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const base = `.segment{font-family:"Komika Axis",sans-serif;font-size:58px;color:#fff;text-align:center;} .being-narrated{color:#ffea00;}`;
  const fonts = fontBytes.length > 0
    ? [{ name: 'Komika Axis', data: new Uint8Array(fontBytes) }]
    : undefined;
  const variants: Record<string, string> = {
    noFont: base,
    withFont: base,
    stroke: `${base} .word{-webkit-text-stroke:2px #000;paint-order:stroke fill;}`,
    shadow: `${base} .word{text-shadow:-2px 0 0 #000,2px 0 0 #000,0 -2px 0 #000,0 2px 0 #000,-2px -2px 0 #000,2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000;}`,
  };
  const out: Record<string, number[]> = {};
  for (const [key, css] of Object.entries(variants)) {
    const png = await render(node, {
      width: 720,
      height: 400,
      css: [root, css],
      ...(key === 'noFont' ? {} : { fonts: fonts as never[] }),
    });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};

// ---- Template compatibility matrix -------------------------------------
// One fixed synthetic document rendered per template through BOTH engines
// at the same instant: Takumi (PNG bytes) and the browser (measured rects
// with CSS animations frozen at timeMs via the Web Animations API).
// Viewport must be 720x1280 so browser cqh/cqw resolve to the same numbers
// the Takumi path pre-resolves to px.

export interface MatrixBrowserWord {
  rect: { x: number; y: number; w: number; h: number };
  visibility: string;
}

export interface MatrixCaseResult {
  name: string;
  t: number;
  takumi: { png: number[] } | { error: string };
  browser: {
    segments: ReadonlyArray<{ x: number; y: number; w: number; h: number }>;
    words: ReadonlyArray<MatrixBrowserWord>;
    animationCount: number;
  } | { error: string };
  font: { family: string; loaded: boolean; browserLoaded: boolean };
}

let matrixDoc: Document | null = null;
const matrixFontCache = new Map<string, unknown[]>();

window.matrixNames = () => galleryTemplateNames();

function getMatrixDoc(): Document {
  if (matrixDoc) return matrixDoc;
  const w = (text: string, s: number, e: number) => new Word({ text, time: new TimeFragment(s, e) });
  matrixDoc = new Document({
    sections: [new Section({
      kind: 'matrix',
      segments: [
        new Segment({
          lines: [
            new Line({ words: [w('Pack', 0, 0.5), w('my', 0.5, 1), w('box', 1, 1.5), w('with', 1.5, 2)] }),
            new Line({ words: [w('five', 0.2, 0.9), w('dozen', 0.9, 1.6), w('liquor', 1.6, 2.2), w('jugs!', 2.2, 2.5)] }),
          ],
          customTime: new TimeFragment(0, 2.5),
        }),
        new Segment({
          lines: [new Line({ words: [w('Sphinx', 3, 3.6), w('of', 3.6, 4), w('black', 4, 4.6), w('quartz,', 4.6, 5.2), w('judge', 5.2, 5.5)] })],
          customTime: new TimeFragment(3, 5.5),
        }),
      ],
    })],
  });
  return matrixDoc;
}

async function matrixFonts(name: string): Promise<{ fonts: unknown[] | undefined; family: string; loaded: boolean; browserLoaded: boolean }> {
  const family = galleryFontFamily(name);
  const cached = matrixFontCache.get(family);
  if (cached !== undefined) return { fonts: cached, family, loaded: true, browserLoaded: true };
  try {
    const { googleFonts } = await import('takumi-js/helpers');
    const fonts = (await googleFonts([{ name: family }])) as unknown[];
    matrixFontCache.set(family, fonts);
    // Mirror the same bytes into document.fonts so the browser probe
    // measures the real typeface too — otherwise every template drifts on
    // font metrics alone and nothing can go green.
    let browserLoaded = false;
    try {
      const subsets = fonts as unknown as Array<{
        subsetOf: string;
        ranges: ReadonlyArray<readonly [number, number]>;
        data: () => Promise<ArrayBuffer>;
      }>;
      const latin = subsets.find((s) => s.ranges.some(([a, b]) => a <= 65 && 65 <= b)) ?? subsets[0];
      if (latin) {
        const face = new FontFace(latin.subsetOf, await latin.data());
        await face.load();
        document.fonts.add(face);
        browserLoaded = true;
      }
    } catch {
      // Browser side stays fallback; Takumi side still exact.
    }
    return { fonts, family, loaded: true, browserLoaded };
  } catch {
    return { fonts: undefined, family, loaded: false, browserLoaded: false };
  }
}

/** Zero-size grid anchor mirroring SegmentWrapperRenderer.composeAnchorStyle. */
function buildGalleryAnchor(name: string): string {
  const json = (galleryTemplateJson(name) as {
    alignment: { verticalAlign: string; verticalOffset: number };
  }).alignment;
  const yPx = Math.round(json.verticalOffset * 1280);
  const xPx = Math.round(0.5 * 720);
  const vGridAlign = json.verticalAlign === 'top' ? 'start' : json.verticalAlign === 'center' ? 'center' : 'end';
  return `position:absolute;top:${yPx}px;left:${xPx}px;width:0;height:0;display:grid;grid-template:0 / 0;align-items:${vGridAlign};justify-items:center;`;
}

function ensureMatrixProbe(): HTMLElement {
  let probe = document.getElementById('matrix-probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'matrix-probe';
    probe.setAttribute('style', 'position:fixed;left:0;top:0;width:720px;height:1280px;visibility:hidden;');
    document.body.appendChild(probe);
  }
  return probe;
}

window.matrixCase = async (name: string, t: number, keepMounted = false): Promise<MatrixCaseResult> => {
  const doc = getMatrixDoc();
  // NOTE: styles keyed 'matrix' while sections carry kind 'matrix'.
  const style = buildGalleryStyle(name, 720, 1280);
  const styles = { matrix: style };
  const font = await matrixFonts(name);
  const layered = galleryUsesSvgFilter(name);
  // --- Takumi side (production code path) ---
  let takumi: MatrixCaseResult['takumi'];
  let captured = { node: '', css: [] as string[] };
  try {
    const takumiRender: TakumiRenderFn = async (node, options) => {
      captured = { node, css: [...options.css] };
      const out = await render(node, {
        width: options.width,
        height: options.height,
        css: [...options.css],
        timeMs: options.timeMs,
        ...(options.fonts !== undefined ? { fonts: options.fonts as never[] } : {}),
      });
      return out instanceof Uint8Array ? out : new Uint8Array(out);
    };
    const renderer = new TakumiSubtitleFrameRenderer(takumiRender, {
      ...(font.fonts === undefined ? {} : { fonts: font.fonts }),
      layeredOutline: layered,
    });
    await renderer.open(doc, styles, 720, 1280);
    const [frame] = await renderer.getFrames([t]);
    renderer.close();
    if (!frame) throw new Error('no frame (nothing active)');
    // Re-render once capturing PNG bytes for the driver to analyze. The
    // fallback CSS rides only here (browser truth must not see it).
    const png = await render(captured.node, {
      width: 720,
      height: 1280,
      css: [...captured.css, ...(layered ? [galleryTakumiFallbackCss(name, galleryFontPx(name, 1280))] : [])],
      timeMs: Math.round(t * 1000),
      ...(font.fonts === undefined ? {} : { fonts: font.fonts as never[] }),
    });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    takumi = { png: [...bytes] };
  } catch (err) {
    takumi = { error: err instanceof Error ? err.message : String(err) };
  }
  // --- Browser side (same node+css, animations frozen at timeMs) ---
  // Anchored exactly like SegmentWrapperRenderer: a zero-size grid at the
  // anchor point places the caption without transforms. Without this,
  // bottom/center templates would sit in static flow (top) while Takumi
  // honors the anchor — a pure harness artifact, not renderer drift.
  let browser: MatrixCaseResult['browser'];
  try {
    if (captured.node === '') throw new Error('no node captured');
    const probe = ensureMatrixProbe();
    probe.innerHTML = '';
    const anchor = buildGalleryAnchor(name);
    const styleEl = document.createElement('style');
    // Neutralize the Takumi root/layer boxes inside the probe: the anchor
    // owns positioning here, and background on layers would double-paint.
    // The caption subtree keeps every template class, var, and animation.
    styleEl.textContent = `${captured.css.join('\n')}\n` +
      '.tscaps-takumi-root{position:static !important;width:max-content !important;height:auto !important;background:transparent !important;}' +
      '.tscaps-takumi-layer{position:static !important;width:auto !important;height:auto !important;display:block !important;padding:0 !important;background:transparent !important;}';
    probe.appendChild(styleEl);
    const anchorEl = document.createElement('div');
    anchorEl.setAttribute('style', anchor);
    anchorEl.innerHTML = captured.node;
    probe.appendChild(anchorEl);
    const timeMs = Math.round(t * 1000);
    let animationCount = 0;
    for (const anim of probe.getAnimations({ subtree: true })) {
      animationCount++;
      try {
        anim.currentTime = timeMs;
        anim.pause();
      } catch {
        // Non-seekable effect; count only.
      }
    }
    // Force style/layout flush before measuring.
    void probe.offsetHeight;
    const segments = [...probe.querySelectorAll('.segment')].map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const words = [...probe.querySelectorAll('.word')].slice(0, 24).map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        visibility: getComputedStyle(el).visibility,
      };
    });
    browser = { segments, words, animationCount };
  } catch (err) {
    browser = { error: err instanceof Error ? err.message : String(err) };
  }
  if (!keepMounted) {
    const probe = document.getElementById('matrix-probe');
    if (probe) probe.innerHTML = '';
  }
  return { name, t, takumi, browser, font: { family: font.family, loaded: font.loaded, browserLoaded: font.browserLoaded } };
};

function probeDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const element = document.createElement('video');
    element.preload = 'metadata';
    element.muted = true;
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ width: element.videoWidth, height: element.videoHeight });
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read video metadata'));
    };
    element.src = url;
  });
}

function describeProgressEvent(event: PipelineProgressEvent): string {
  switch (event.stage) {
    case 'transcribing':
      if (event.inner.stage === 'loading') {
        return `Downloading Whisper model: ${Math.round(event.inner.progress * 100)}%`;
      }
      return event.inner.progress !== undefined
        ? `Transcribing audio: ${Math.round(event.inner.progress * 100)}%`
        : 'Transcribing audio…';
    case 'splitting':
      return event.status === 'started' ? 'Splitting segments and lines…' : 'Splitting done';
    case 'tagging-structural':
      return event.status === 'started' ? 'Tagging structure…' : 'Structure tagging done';
    case 'tagging-semantic':
      return event.status === 'started' ? 'Tagging semantics…' : 'Semantic tagging done';
    case 'applying-effects':
      return event.status === 'started' ? 'Applying effects…' : 'Effects done';
    case 'rendering':
      return `Rendering: ${event.inner.percent}% (frame ${event.inner.currentFrame}/${event.inner.totalFrames})`;
  }
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
