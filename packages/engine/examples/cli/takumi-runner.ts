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
import { buildGalleryStyle, gallerySegmentSplitter, galleryEffects, galleryMaxLines, galleryFontFamily, galleryFontPx, galleryTakumiFallbackCss, galleryUsesSvgFilter, galleryClipTextFallback, galleryTemplateNames, galleryTemplateJson, type GalleryTemplateName } from './gallery-style';

export type RunnerStyle = 'default' | GalleryTemplateName;

declare global {
  interface Window {
    renderE2E(videoUrl: string, fontUrl: string | null, hasItalicFont: boolean, renderer: 'takumi' | 'browser', style: RunnerStyle): Promise<void>;
    transcribeOnly(videoUrl: string, style: RunnerStyle): Promise<DocJson>;
    renderFromDocument(videoUrl: string, fontUrl: string | null, hasItalicFont: boolean, renderer: 'takumi' | 'browser', style: RunnerStyle, doc: DocJson): Promise<void>;
    takumiProbe(): Promise<number>;
    picoProbe(): Promise<{ bytes: number; magic: string; data: number[] }>;
    picoSweep(): Promise<{ failures: string[]; data: number[] }>;
    matrixNames(): string[];
    matrixNode(name: string, t: number): Promise<string>;
    accentProbe(): Promise<number[]>;
    lastChildProbe(): Promise<Record<string, number[]>>;
    bgVarProbe(): Promise<Record<string, number[]>>;
    ivoStripProbe(): Promise<Record<string, number[]>>;
    childProbe(): Promise<Record<string, number[]>>;
    tableProbe(): Promise<Record<string, number[]>>;
    lenaProbe(): Promise<Record<string, number[]>>;
    flexProbe(): Promise<Record<string, number[]>>;
    orderProbe(order: string): Promise<Record<string, number[]>>;
    matrixCase(name: string, t: number, keepMounted?: boolean): Promise<MatrixCaseResult>;
    clipTextProbe(first?: string): Promise<Record<string, number[]>>;
    caseProbe(): Promise<Record<string, number[]>>;
    bisectProbe(): Promise<Record<string, number>>;
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

function buildPipeline(video: Blob, style: RunnerStyle, probe: { width: number; height: number }, takumi: boolean, hasItalic: boolean) {
  const builder = new RenderPipelineBuilder().withInputVideo(video);
  if (style !== 'default') {
    const base = buildGalleryStyle(style, probe.width, probe.height, { takumi, hasItalic });
    builder
      .withSubtitleStyle(base)
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
  await document.fonts.ready;
}

// Full stock pipeline on a real video. The ONLY seam under experiment is
// the subtitle frame renderer: Takumi versus the stock browser renderer.
// Transcription (Whisper bawaan), splitting, tagging, effects, compositing,
// and muxing are identical in both runs. Pico applies the real gallery
// template (template.json controls + compiled CSS + JetBrains Mono),
// resolved at the render size exactly as the browser would compute it.
window.renderE2E = async (videoUrl: string, fontUrl: string | null, hasItalicFont: boolean, renderer: 'takumi' | 'browser', style: RunnerStyle) => {
  const inputBlob = await (await fetch(videoUrl)).blob();
  const probe = await probeDimensions(inputBlob);
  await loadDocumentFont(fontUrl, style);
  const takumi = renderer === 'takumi';
  const builder = buildPipeline(inputBlob, style, probe, takumi, hasItalicFont);

  if (takumi) {
    const { fonts, decode } = await adapterFonts(fontUrl, style, hasItalicFont);
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
  const builder = buildPipeline(inputBlob, style, probe, false, false);
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
window.renderFromDocument = async (videoUrl: string, fontUrl: string | null, hasItalicFont: boolean, renderer: 'takumi' | 'browser', style: RunnerStyle, doc: DocJson) => {
  const inputBlob = await (await fetch(videoUrl)).blob();
  const probe = await probeDimensions(inputBlob);
  await loadDocumentFont(fontUrl, style);
  const takumi = renderer === 'takumi';
  const builder = buildPipeline(inputBlob, style, probe, takumi, hasItalicFont);
  if (takumi) {
    const { fonts, decode } = await adapterFonts(fontUrl, style, hasItalicFont);
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

async function adapterFonts(fontUrl: string | null, style: RunnerStyle, hasItalic: boolean) {
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
  return { ...(fonts === undefined ? {} : { fonts }), decode, hasItalic };
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
  font: { family: string; loaded: boolean; browserLoaded: boolean; hasItalic: boolean };
}

interface TakumiFontSet {
  fonts: unknown[] | undefined;
  hasItalic: boolean;
}

/** True when any loaded subset carries an italic/oblique face. */
function fontSetHasItalic(fonts: unknown[] | undefined): boolean {
  if (!fonts) return false;
  const subsets = fonts as unknown as Array<{ style?: string }>;
  return subsets.some((s) => /italic|oblique/i.test(s.style ?? ''));
}

let matrixDoc: Document | null = null;
const matrixFontCache = new Map<string, unknown[]>();

window.matrixNames = () => galleryTemplateNames();

// Returns the exact node string the matrix feeds Takumi (for diffing).
window.matrixNode = async (name: string, t: number): Promise<string> => {
  const doc = getMatrixDoc();
  const style = buildGalleryStyle(name, 720, 1280);
  let captured = '';
  const takumiRender: TakumiRenderFn = async (node) => {
    captured = node;
    return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  };
  const renderer = new TakumiSubtitleFrameRenderer(takumiRender);
  await renderer.open(doc, { matrix: style }, 720, 1280);
  await renderer.getFrames([t]).catch(() => []);
  renderer.close();
  return captured;
};

// Accent var plumbing check: distinctive colors must survive to output.
window.accentProbe = async () => {
  const node = `<div class="tscaps-takumi-root"><div class="segment" style="--tscaps-accent-bg:#ff00ff;--tscaps-accent-color:#00ffff;--on-segment-starts:-1.5s;"><div class="line"><span class="word">FIRST</span></div><div class="line"><span class="word">SECOND</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const css = `.segment{font-size:48px;color:#ffffff;} .line:last-child{background:var(--tscaps-accent-bg, #adff2f);color:var(--tscaps-accent-color, #000000);}`;
  const png = await render(node, { width: 720, height: 400, css: [root, css], timeMs: 1500 });
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
  return [...bytes];
};

// Exact ivo :last-child rule with engine-like inline vars + timing.
window.lastChildProbe = async () => {
  const node = `<div class="tscaps-takumi-root"><div class="segment" style="--tscaps-accent-bg:#adff2f;--tscaps-accent-color:#000000;--on-segment-starts:-1.5s;"><div class="line"><span class="word">FIRST</span></div><div class="line"><span class="word">SECOND</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const base = `.segment{font-size:48px;color:#ffffff;}`;
  const lastChild = `.line:last-child{background:var(--tscaps-accent-bg, #adff2f);color:var(--tscaps-accent-color, #000000);transform:rotate(-2deg);--entrance-duration:0.6s;animation:wobble var(--entrance-duration) var(--on-segment-starts) ease-in-out both;} @keyframes wobble{0%{transform:rotate(-11deg);}100%{transform:rotate(-2deg);}}`;
  const variants: Record<string, string> = {
    full: `${base} ${lastChild}`,
    noAnim: `${base} .line:last-child{background:var(--tscaps-accent-bg, #adff2f);color:var(--tscaps-accent-color, #000000);transform:rotate(-2deg);}`,
    noTransform: `${base} .line:last-child{background:var(--tscaps-accent-bg, #adff2f);color:var(--tscaps-accent-color, #000000);}`,
  };
  const out: Record<string, number[]> = {};
  for (const [key, css] of Object.entries(variants)) {
    for (const ms of [0, 1500, 9000]) {
      const png = await render(node, { width: 720, height: 400, css: [root, css], timeMs: ms });
      const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      out[`${key}-t${ms}`] = [...bytes];
    }
  }
  return out;
};

// background:var() vs color:var() — does the background shorthand resolve
// custom properties in Takumi?
window.bgVarProbe = async () => {
  const node = `<div class="tscaps-takumi-root"><div class="segment" style="--bgc:#adff2f;--txc:#000000;"><div class="line"><span class="word">HELLO</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const base = `.segment{font-size:64px;} .line{display:block;padding:10px 20px;} .word{display:inline-block;}`;
  const variants: Record<string, string> = {
    both: `${base} .line{background:var(--bgc, #adff2f);color:var(--txc, #000000);}`,
    bgOnly: `${base} .line{background:var(--bgc, #adff2f);}`,
    colorOnly: `${base} .line{color:var(--txc, #000000);}`,
    bgLiteral: `${base} .line{background:#adff2f;}`,
  };
  const out: Record<string, number[]> = {};
  for (const [key, css] of Object.entries(variants)) {
    const png = await render(node, { width: 720, height: 400, css: [root, css] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};

// Ivo strip probe: full built style minus animation / transform, to find
// what displaces line 2 and drops its accent background.
window.ivoStripProbe = async () => {
  const style = buildGalleryStyle('ivo', 720, 1280);
  const node = `<div class="tscaps-takumi-root"><div class="tscaps-takumi-layer"><div class="tscaps-takumi-caption"><div class="segment"><div class="line"><span class="word">PACK MY</span></div><div class="line"><span class="word">BOX WITH</span></div></div></div></div></div>`;
  const strip = (css: string, re: RegExp): string => css.replace(re, '');
  const variants: Record<string, string> = {
    full: style.css,
    noAnimation: strip(style.css, /animation:[^;]+;/g),
    noTransform: strip(style.css, /(?<!-webkit-)transform:[^;]+;/g),
    noAnimTransform: strip(strip(style.css, /animation:[^;]+;/g), /(?<!-webkit-)transform:[^;]+;/g),
  };
  const out: Record<string, number[]> = {};
  for (const [key, css] of Object.entries(variants)) {
    const png = await render(node, { width: 720, height: 1280, css, timeMs: 1500 });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};

// Structural pseudo-class probe (ivo): do :first-child/:last-child rules
// apply in Takumi?
window.childProbe = async () => {
  const node = `<div class="tscaps-takumi-root"><div class="segment"><div class="line"><span class="word">FIRST</span></div><div class="line"><span class="word">SECOND</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const base = `.segment{font-size:48px;color:#fff;} .line{display:block;padding:10px 20px;} .line:first-child{background:#000000;} .line:last-child{background:#adff2f;color:#000000;}`;
  const png = await render(node, { width: 720, height: 400, css: [root, base] });
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
  return { child: [...bytes] };
};

// display:table shrink-to-fit probe (ivo): does block+fit-content+auto
// margins reproduce the table box in Takumi?
window.tableProbe = async () => {
  const node = `<div class="tscaps-takumi-root"><div class="tscaps-takumi-layer"><div class="tscaps-takumi-caption"><div class="segment"><div class="line"><span class="word">PACK MY BOX</span></div><div class="line"><span class="word">WITH FIVE</span></div></div></div></div></div>`;
  const root = '.tscaps-takumi-root{position:relative;width:100%;height:100%;background:transparent;} .tscaps-takumi-layer{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;box-sizing:border-box;justify-content:center;align-items:flex-end;background:transparent;} .tscaps-takumi-caption{max-width:92%;background:transparent;}';
  const base = `.segment{font-size:40px;color:#fff;text-align:center;} .word{display:inline-block;}`;
  const variants: Record<string, string> = {
    table: `${base} .line{display:table;margin:0 auto;padding:0.2em 0.4em;background:#000;}`,
    blockFit: `${base} .line{display:block;width:fit-content;margin-left:auto;margin-right:auto;padding:0.2em 0.4em;background:#000;}`,
  };
  const out: Record<string, number[]> = {};
  for (const [key, css] of Object.entries(variants)) {
    const png = await render(node, { width: 720, height: 400, css: [root, css] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};

// Lena reproduction through the REAL renderer: full built style, matrix
// doc content, real render. Returns the frame PNG bytes.
window.lenaProbe = async () => {
  const style = buildGalleryStyle('lena', 720, 1280);
  const w = (text: string, s: number, e: number) => new Word({ text, time: new TimeFragment(s, e) });
  const doc = new Document({
    sections: [new Section({
      kind: 'lena',
      segments: [new Segment({
        lines: [
          new Line({ words: [w('Pack', 0, 0.5), w('my', 0.5, 1), w('box', 1, 1.5), w('with', 1.5, 2)] }),
          new Line({ words: [w('five', 0.2, 0.9), w('dozen', 0.9, 1.6), w('liquor', 1.6, 2.2), w('jugs!', 2.2, 2.5)] }),
        ],
        customTime: new TimeFragment(0, 2.5),
      })],
    })],
  });
  const captures: Record<string, number[]> = {};
  const fullCss = (style: { css: string }) => style.css;
  void fullCss;
  for (const key of ['full', 'noAnim']) {
    const cssOverride = key === 'full' ? null : /\.line\{[^}]*animation:[^;]+;[^\}]*\}/;
    void cssOverride;
    const takumiRender: TakumiRenderFn = async (node, options) => {
      let css = [...options.css];
      if (key !== 'full') {
        css = css.map((s) => s.replace(/\.line\s*\{[^}]*animation:[^;]+;/g, '.line{'));
      }
      const out = await render(node, {
        width: options.width,
        height: options.height,
        css,
        timeMs: options.timeMs,
      });
      const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
      captures[key] = [...bytes];
      return bytes;
    };
    const renderer = new TakumiSubtitleFrameRenderer(takumiRender);
    await renderer.open(doc, { lena: style }, 720, 1280);
    await renderer.getFrames([1.5]);
    renderer.close();
  }
  // Halves of the real stylesheet: which half carries the left-pinning?
  // (Superseded by targeted strips below; kept for the record.)
  const rules = style.css.split('}').filter((r) => r.trim() !== '');
  const half = Math.ceil(rules.length / 2);
  const stripProp = (css: string, prop: string): string =>
    css.replace(new RegExp(`${prop}\\s*:[^;]+;`, 'g'), '');
  const stripKeyframes = (css: string): string =>
    css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  for (const [hk, hcss] of Object.entries({
    cssHalf1: `${rules.slice(0, half).join('}')}}`,
    cssHalf2: `${rules.slice(half).join('}')}}`,
  })) {
    const takumiRender: TakumiRenderFn = async (node, options) => {
      const out = await render(node, {
        width: options.width,
        height: options.height,
        css: [options.css[0]!, hcss],
        timeMs: options.timeMs,
      });
      const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
      captures[hk] = [...bytes];
      return bytes;
    };
    const renderer = new TakumiSubtitleFrameRenderer(takumiRender);
    await renderer.open(doc, { lena: style }, 720, 1280);
    await renderer.getFrames([1.5]);
    renderer.close();
  }
  // Same full render at 720x400: is the pinning canvas-height dependent?
  {
    const takumiRender: TakumiRenderFn = async (node, options) => {
      const out = await render(node, {
        width: 720,
        height: 400,
        css: [...options.css],
        timeMs: options.timeMs,
      });
      const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
      captures['short'] = [...bytes];
      return bytes;
    };
    const renderer = new TakumiSubtitleFrameRenderer(takumiRender);
    await renderer.open(doc, { lena: style }, 720, 400);
    await renderer.getFrames([1.5]);
    renderer.close();
  }
  // Same full render with NO timeMs: does animation sampling unpin it?
  {
    const takumiRender: TakumiRenderFn = async (node, options) => {
      const out = await render(node, {
        width: options.width,
        height: options.height,
        css: [...options.css],
      });
      const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
      captures['noTime'] = [...bytes];
      return bytes;
    };
    const renderer = new TakumiSubtitleFrameRenderer(takumiRender);
    await renderer.open(doc, { lena: style }, 720, 1280);
    await renderer.getFrames([1.5]);
    renderer.close();
  }
  // Targeted strips of the full stylesheet: which declaration pins left?
  for (const prop of ['gap', 'flex-direction', 'align-items', 'position', 'box-shadow', 'border-radius', 'background', 'padding', 'max-width']) {
    const stripped = stripProp(style.css, prop);
    const strippedFull = prop === 'gap' ? stripped : stripKeyframes(stripped);
    const takumiRender: TakumiRenderFn = async (node, options) => {
      const out = await render(node, {
        width: options.width,
        height: options.height,
        css: [options.css[0]!, strippedFull],
        timeMs: options.timeMs,
      });
      const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
      captures[`no-${prop}`] = [...bytes];
      return bytes;
    };
    const renderer = new TakumiSubtitleFrameRenderer(takumiRender);
    await renderer.open(doc, { lena: style }, 720, 1280);
    await renderer.getFrames([1.5]);
    renderer.close();
  }
  return captures;
};

// Flex-column segment shrink-wrap probe (lena): which caption width rule
// centers the bubbles instead of pinning them at x=0?
window.flexProbe = async () => {
  const node = `<div class="tscaps-takumi-root"><div class="tscaps-takumi-layer"><div class="tscaps-takumi-caption"><div class="segment"><div class="line"><span class="word">PACK MY</span></div><div class="line"><span class="word">BOX WITH</span></div></div></div></div></div>`;
  const seg = `.segment{display:flex;flex-direction:column;align-items:flex-start;font-size:32px;color:#fff;} .line{padding:0.3em 0.47em;background:#2997ff;border-radius:0.6em;} .word{display:inline-block;}`;
  const layer = (cap: string) =>
    `.tscaps-takumi-root{position:relative;width:100%;height:100%;background:transparent;} .tscaps-takumi-layer{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;box-sizing:border-box;justify-content:center;align-items:flex-end;background:transparent;} .tscaps-takumi-caption{max-width:92%;background:transparent;${cap}}`;
  const variants: Record<string, string> = {
    auto: layer(''),
    fitContent: layer('width:fit-content;'),
    maxContent: layer('width:max-content;'),
    anim: layer('') + ` .line{animation:risein 0.32s -1.5s cubic-bezier(0.34,1.4,0.5,1) both;} @keyframes risein{from{opacity:0;transform:translateY(0.27em);}to{opacity:1;transform:translateY(0);}}`,
    tail: layer('') + ` .line{position:relative;} .line:last-child::after{content:"";display:block;position:absolute;left:-0.23em;bottom:0;width:0.53em;height:0.47em;background:#2997ff;clip-path:polygon(100% 0%,0% 0%,25% 85%,75% 100%,87% 30%);}`,
    shadow: layer('') + ` .line{box-shadow:0 0.03em 0.07em rgba(0,0,0,0.16);}`,
    matrixNode: layer(''),
  };
  const nodes: Record<string, string> = {
    matrixNode: `<div class="tscaps-takumi-root"><div class="tscaps-takumi-layer"><div class="tscaps-takumi-caption"><div class="segment" style="--segment-index:0;"><div class="line" style="direction:ltr;"><span class="word" style="--word-index:0;">Pack</span> <span class="word" style="--word-index:1;">my</span> <span class="word" style="--word-index:2;">box</span> <span class="word" style="--word-index:3;">with</span></div><div class="line" style="direction:ltr;"><span class="word" style="--word-index:0;">five</span> <span class="word" style="--word-index:1;">dozen</span> <span class="word" style="--word-index:2;">liquor</span> <span class="word" style="--word-index:3;">jugs!</span></div></div></div></div></div>`,
    matrixVarsNode: `<div class="tscaps-takumi-root"><div class="tscaps-takumi-layer"><div class="tscaps-takumi-caption"><div class="segment segment-being-narrated" style="--on-segment-starts:-1.500s;--on-segment-ends:1.000s;--segment-duration:2.500s;--segment-char-count:41;--segment-index:0;--word-count:8;--last-word-char-count:5;"><div class="line line-being-narrated" style="direction:ltr;--on-line-being-narrated-starts:-1.500s;--on-line-being-narrated-ends:0.500s;--line-being-narrated-duration:2.000s;"><span class="word word-being-narrated" style="--on-word-being-narrated-starts:-1.500s;--on-word-being-narrated-ends:-1.000s;--word-being-narrated-duration:0.500s;--word-index:0;--word-char-count:4;">Pack</span> <span class="word word-being-narrated" style="--word-index:1;">my</span> <span class="word word-being-narrated" style="--word-index:2;">box</span> <span class="word word-being-narrated" style="--word-index:3;">with</span></div><div class="line line-not-narrated-yet" style="direction:ltr;"><span class="word word-not-narrated-yet" style="--word-index:0;">five</span> <span class="word word-not-narrated-yet" style="--word-index:1;">dozen</span> <span class="word word-not-narrated-yet" style="--word-index:2;">liquor</span> <span class="word word-not-narrated-yet" style="--word-index:3;">jugs!</span></div></div></div></div></div>`,
  };
  const lenaFull = buildGalleryStyle('lena', 720, 1280);
  const lenaVars = Object.entries(lenaFull.inlineStyles).map(([k, v]) => `${k}:${v};`).join('');
  const out: Record<string, number[]> = {};
  {
    // Matrix node + FULL lena css: does the real combination pin left?
    const png = await render(nodes['matrixNode']!, {
      width: 720,
      height: 1280,
      css: [layer(''), lenaFull.css],
      timeMs: 1500,
    });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out['matrixFull'] = [...bytes];
  }
  {
    // Same but with engine state classes + timing vars (the remaining delta).
    const png = await render(nodes['matrixVarsNode']!, {
      width: 720,
      height: 1280,
      css: [layer(''), lenaFull.css],
      timeMs: 1500,
    });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out['matrixVarsNode'] = [...bytes];
  }
  {
    // Same + engine inline vars on the segment (the remaining delta).
    const varNode = `<div class="tscaps-takumi-root"><div class="tscaps-takumi-layer"><div class="tscaps-takumi-caption"><div class="segment" style="${lenaVars}"><div class="line" style="direction:ltr;"><span class="word">Pack</span> <span class="word">my</span></div></div></div></div></div>`;
    const png = await render(varNode, {
      width: 720,
      height: 1280,
      css: [layer(''), lenaFull.css],
      timeMs: 1500,
    });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out['matrixVars'] = [...bytes];
  }
  for (const [key, css] of Object.entries(variants)) {
    const useNode = nodes[key] ?? node;
    const png = await render(useNode, { width: 720, height: 400, css: [css, seg], timeMs: 1500 });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};

// background-clip:text matrix: which gradient shapes survive Takumi.
// Bisects the REAL levi stylesheet to find the declaration that empties
// Takumi output. Same node the matrix emits (classes + timing vars).
window.bisectProbe = async () => {
  const style = buildGalleryStyle('levi', 720, 1280);
  const full = style.css;
  const node = `<div class="tscaps-takumi-root"><div class="segment" style="--on-segment-starts:-1s;--segment-duration:2s;"><div class="line" style="--on-line-being-narrated-starts:-1s;--line-being-narrated-duration:1s;"><span class="word" style="--on-word-being-narrated-starts:-0.5s;--word-being-narrated-duration:0.5s;">GRADIENT</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const strip = (css: string, re: RegExp): string => css.replace(re, '');
  const variants: Record<string, string> = {
    full: full,
    noKeyframes: strip(full, /@keyframes[\s\S]*?^\}/gm),
    noAnimation: strip(full, /animation:[^;]+;/g),
    noFilter: strip(full, /filter:[^;]+;/g),
    noTransform: strip(full, /text-transform:[^;]+;/g),
    noRotate: strip(full, /rotate:[^;]+;/g),
    noClip: strip(full, /(-webkit-)?background-clip:[^;]+;/g),
  };
  const out: Record<string, number> = {};
  for (const [key, css] of Object.entries(variants)) {
    try {
      const png = await render(node, { width: 720, height: 400, css: [root, css], timeMs: 1500 });
      const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      out[key] = bytes.length;
    } catch {
      out[key] = -1;
    }
  }
  return out;
};
// text-transform matrix: does Takumi uppercase, via literal and var()?
window.caseProbe = async () => {
  const { googleFonts } = await import('takumi-js/helpers');
  const fonts = await googleFonts([{ name: 'Bungee' }]);
  const info = (fonts as unknown as Array<{ name: string; subsetOf: string; weight?: number; style?: string }>).map((f) => ({
    name: f.name,
    subsetOf: f.subsetOf,
    weight: f.weight,
    style: f.style,
  }));
  const node = `<div class="tscaps-takumi-root"><div class="segment"><span class="word">SPHINX OF BLACK QUARTZ JUDGE</span></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const base = `.segment{font-family:"Bungee",sans-serif;font-size:50px;color:#fff;}`;
  const variants: Record<string, string> = {
    normal: base,
    italic: `${base} .segment{font-style:italic;}`,
    normalExplicit: `${base} .segment{font-style:normal;}`,
  };
  const out: Record<string, number[]> = {};
  // max()/min()/clamp() support probe (cleo/mira/noor dynamic font scale).
  const varNode = `<div class="tscaps-takumi-root"><div class="segment" style="--s:50px;"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
  const ivoNode = `<div class="tscaps-takumi-root"><div class="segment" style="--tscaps-font-size:65.02px;"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
  const ivoBoth = `<div class="tscaps-takumi-root"><div class="segment" style="--tscaps-font-size:65.02px;--tscaps-font-size-scale:1;"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
  for (const [mk, mv] of Object.entries({
    ivoShape: `.segment{font-family:"Bungee";font-size:calc(var(--tscaps-font-size, 5.08cqh) * var(--tscaps-font-size-scale, 1));color:#fff;}`,
  })) {
    const png = await render(ivoNode, { width: 720, height: 400, css: [root, mv], fonts: fonts as never[] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[`max-${mk}`] = [...bytes];
  }
  {
    const mv = `.segment{font-family:"Bungee";font-size:calc(var(--tscaps-font-size, 5.08cqh) * var(--tscaps-font-size-scale, 1));color:#fff;}`;
    const png = await render(ivoBoth, { width: 720, height: 400, css: [root, mv], fonts: fonts as never[] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out['max-ivoBoth'] = [...bytes];
    // Isolate: long var names vs values.
    const shortNames = `<div class="tscaps-takumi-root"><div class="segment" style="--s:65.02px;--f:1;"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
    const shortCss = `.segment{font-family:"Bungee";font-size:calc(var(--s, 5.08cqh) * var(--f, 1));color:#fff;}`;
    const pngS = await render(shortNames, { width: 720, height: 400, css: [root, shortCss], fonts: fonts as never[] });
    const bytesS = pngS instanceof Uint8Array ? pngS : new Uint8Array(pngS);
    out['max-shortNames'] = [...bytesS];
  }
  const latin = (fonts as unknown as Array<{
    subsetOf: string;
    ranges: ReadonlyArray<readonly [number, number]>;
    data: () => Promise<ArrayBuffer>;
  }>).find((s) => s.ranges.some(([a, b]) => a <= 65 && 65 <= b));
  if (latin) {
    const raw = await latin.data();
    console.log(`[caseProbe] latin bytes: ${raw.byteLength}`);
    const magic = [...new Uint8Array(raw).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
    console.log(`[caseProbe] latin magic: ${magic}`);
    const single = [{ name: latin.subsetOf, data: new Uint8Array(raw) }];
    for (const glyph of ['H', 'Hx', 'i']) {
      const gnode = `<div class="tscaps-takumi-root"><div class="segment"><span class="word">${glyph}</span></div></div>`;
      const gpng = await render(gnode, { width: 720, height: 400, css: [root, base], fonts: single as never[] });
      const gbytes = gpng instanceof Uint8Array ? gpng : new Uint8Array(gpng);
      out[`glyph-${glyph}`] = [...gbytes];
    }
    const png = await render(node, { width: 720, height: 400, css: [root, base], fonts: single as never[] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out['single'] = [...bytes];
    const full = [{ name: latin.subsetOf, data: new Uint8Array(raw), weight: 400, style: 'normal' }];
    const png2 = await render(node, {
      width: 720, height: 400, css: [root, base], fonts: full as never[],
      fontFamilies: ['Bungee'],
    } as never);
    const bytes2 = png2 instanceof Uint8Array ? png2 : new Uint8Array(png2);
    out['singleStack'] = [...bytes2];
    const oneSpan = `<div class="tscaps-takumi-root"><div class="segment"><span class="word">SPHINX OF BLACK QUARTZ JUDGE</span></div></div>`;
    const png4 = await render(oneSpan, { width: 720, height: 400, css: [root, base], fonts: single as never[] });
    const bytes4 = png4 instanceof Uint8Array ? png4 : new Uint8Array(png4);
    out['singleSpan'] = [...bytes4];
    const noSpaces = `<div class="tscaps-takumi-root"><div class="segment"><span class="word">SPHINXOFBLACKQUARTZJUDGE</span></div></div>`;
    const png6 = await render(noSpaces, { width: 720, height: 400, css: [root, base], fonts: single as never[] });
    const bytes6 = png6 instanceof Uint8Array ? png6 : new Uint8Array(png6);
    out['noSpaces'] = [...bytes6];
    const line1 = `<div class="tscaps-takumi-root"><div class="segment"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
    const lit = `.segment{font-family:"Bungee";font-size:50px;color:#fff;}`;
    const png5 = await render(line1, { width: 720, height: 400, css: [root, lit], fonts: single as never[] });
    const bytes5 = png5 instanceof Uint8Array ? png5 : new Uint8Array(png5);
    out['lit50'] = [...bytes5];
    const varNode = `<div class="tscaps-takumi-root"><div class="segment" style="--s:50px;"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
    for (const [vk, vcss] of Object.entries({
      varOnly: `.segment{font-family:"Bungee";font-size:var(--s);color:#fff;}`,
      varCalc: `.segment{font-family:"Bungee";font-size:calc(var(--s) * 1);color:#fff;}`,
      varCalcFallback: `.segment{font-family:"Bungee";font-size:calc(var(--s, 3.91cqh) * var(--f, 1));color:#fff;}`,
    })) {
      const png = await render(varNode, { width: 720, height: 400, css: [root, vcss], fonts: single as never[] });
      const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      out[`var-${vk}`] = [...bytes];
    }
    // Full juno style through the real builder, inline vars like the matrix.
    const junoStyle = buildGalleryStyle('juno', 720, 1280, { takumi: true, hasItalic: false });
    const junoVars = Object.entries(junoStyle.inlineStyles).map(([k, v]) => `${k}:${v};`).join('');
    const junoNode = `<div class="tscaps-takumi-root"><div class="segment" style="${junoVars}"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
    const junoRender = async (css: string) => {
      const png = await render(junoNode, { width: 720, height: 400, css: [root, css], fonts: single as never[] });
      const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      return [...bytes];
    };
    out['fullJuno'] = await junoRender(junoStyle.css);
    for (const prop of ['letter-spacing', 'line-height', 'text-transform', 'font-style', 'font-weight', 'text-shadow', '-webkit-text-stroke', 'text-align', 'rotate']) {
      const stripped = junoStyle.css.replace(new RegExp(`${prop}\\s*:[^;]+;`, 'g'), '');
      out[`no-${prop}`] = await junoRender(stripped);
    }
    const rules = junoStyle.css.split('}').filter((r) => r.trim() !== '');
    const half = Math.ceil(rules.length / 2);
    for (const [hk, hcss] of Object.entries({
      half1: `${rules.slice(0, half).join('}')}}`,
      half2: `${rules.slice(half).join('}')}}`,
    })) {
      const png = await render(junoNode, { width: 720, height: 400, css: [root, hcss], fonts: single as never[] });
      const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      out[hk] = [...bytes];
    }
  }
  // Full juno style through the real builder, vars inline like the matrix.
  const junoStyle = buildGalleryStyle('juno', 720, 1280, { takumi: true, hasItalic: false });
  const junoVars = Object.entries(junoStyle.inlineStyles).map(([k, v]) => `${k}:${v};`).join('');
  const junoNode = `<div class="tscaps-takumi-root"><div class="segment" style="${junoVars}"><span class="word">SPHINX OF BLACK QUARTZ JUDGE</span></div></div>`;
  {
    const png = await render(junoNode, { width: 720, height: 400, css: [root, junoStyle.css], fonts: fonts as never[] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out['full'] = [...bytes];
  }
  for (const [key, css] of Object.entries(variants)) {
    const png = await render(node, { width: 720, height: 400, css: [root, css], fonts: fonts as never[] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  console.log(`[caseProbe] bungee subsets: ${JSON.stringify(info)}`);
  return out;
};
// Order-controlled minimal probe: literal 50px Bungee vs the ivo var/calc
// shape, in both orders, fresh page each run.
window.orderProbe = async (order: string) => {
  const { googleFonts } = await import('takumi-js/helpers');
  const fonts = await googleFonts([{ name: 'Bungee' }]);
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const nodeOf = (style: string) =>
    `<div class="tscaps-takumi-root"><div class="segment" style="${style}"><span class="word">SPHINX OF BLACK QUARTZ,</span></div></div>`;
  const lit = `.segment{font-family:"Bungee";font-size:50px;color:#fff;}`;
  const ivo = `.segment{font-family:"Bungee";font-size:calc(var(--tscaps-font-size, 5.08cqh) * var(--tscaps-font-size-scale, 1));color:#fff;}`;
  const ivoVars = `--tscaps-font-size:65.02px;`;
  const jobs: Record<string, { node: string; css: string }> = order === 'ivo-first'
    ? {
      aIvo: { node: nodeOf(ivoVars), css: ivo },
      bLit: { node: nodeOf(''), css: lit },
      cBoth: { node: nodeOf(`${ivoVars}--tscaps-font-size-scale:1;`), css: ivo },
      dDirect: { node: nodeOf(ivoVars), css: `.segment{font-family:"Bungee";font-size:var(--tscaps-font-size);color:#fff;}` },
    }
    : {
      aLit: { node: nodeOf(''), css: lit },
      bIvo: { node: nodeOf(ivoVars), css: ivo },
      cBoth: { node: nodeOf(`${ivoVars}--tscaps-font-size-scale:1;`), css: ivo },
      dDirect: { node: nodeOf(ivoVars), css: `.segment{font-family:"Bungee";font-size:var(--tscaps-font-size);color:#fff;}` },
    };
  const out: Record<string, number[]> = {};
  for (const [key, job] of Object.entries(jobs)) {
    const png = await render(job.node, { width: 720, height: 400, css: [root, job.css], fonts: fonts as never[] });
    const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
    out[key] = [...bytes];
  }
  return out;
};
window.clipTextProbe = async (first = '') => {
  const node = `<div class="tscaps-takumi-root"><div class="segment"><div class="line"><span class="word">Gradient</span></div></div></div>`;
  const root = '.tscaps-takumi-root{width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:transparent;}';
  const base = `.segment{font-size:64px;color:transparent;background-clip:text;-webkit-background-clip:text;}`;
  const variants: Record<string, string> = {
    simple: `${base} .segment{background-image:linear-gradient(180deg,#ffffff 0%,#888888 100%);}`,
    colormix: `${base} .segment{background-image:linear-gradient(180deg,#ffffff 0%,color-mix(in srgb,#ffffff,#000 18%) 100%);}`,
    calcangle: `${base} .segment{background-image:linear-gradient(calc(100 * 1deg),#ff6ec4,#4dd4ff,#b6f56d);background-size:400% 100%;}`,
    varangle: `${base} .segment{background-image:linear-gradient(calc(var(--a, 100) * 1deg),#ff6ec4,#4dd4ff);}`,
    leviLine: `.line{display:block;background-image:linear-gradient(180deg,#ffffff 0%,color-mix(in srgb,#ffffff,#000 18%) 100%);background-clip:text;-webkit-background-clip:text;color:transparent;} .word{display:inline-block;}`,
    layerOpacity: `.line{display:block;background-image:linear-gradient(180deg,#ffffff 0%,color-mix(in srgb,#ffffff,#000 18%) 100%);background-clip:text;-webkit-background-clip:text;color:transparent;filter:opacity(1);} .word{display:inline-block;}`,
    layerBright: `.line{display:block;background-image:linear-gradient(180deg,#ffffff 0%,color-mix(in srgb,#ffffff,#000 18%) 100%);background-clip:text;-webkit-background-clip:text;color:transparent;filter:brightness(1);} .word{display:inline-block;}`,
    leviFilter: `.line{display:block;background-image:linear-gradient(180deg,#ffffff 0%,color-mix(in srgb,#ffffff,#000 18%) 100%);background-clip:text;-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 0.03em 0.12em #000000);}`,
    leviVarFilter: `.segment{--d:0.03em;} .line{display:block;background-image:linear-gradient(180deg,#ffffff 0%,color-mix(in srgb,#ffffff,#000 18%) 100%);background-clip:text;-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 var(--d) 0.12em #000000);}`,
    lowerUpper: `.segment{font-size:64px;text-transform:uppercase;background:#fff;color:#000;}`,
    lowerClip: `.segment{font-size:64px;color:transparent;background-clip:text;-webkit-background-clip:text;background-image:linear-gradient(180deg,#ffffff 0%,#888888 100%);}`,
    leviAnim: `.line{display:block;background-image:linear-gradient(180deg,#ffffff 0%,color-mix(in srgb,#ffffff,#000 18%) 100%);background-clip:text;-webkit-background-clip:text;color:transparent;--entrance-fade:0;animation:risein 0.28s -1.5s ease-out both;} @keyframes risein{from{opacity:var(--entrance-fade);transform:translateY(0em);}to{opacity:1;transform:translateY(0);}}`,
  };
  const out: Record<string, number[]> = {};
  const keys = Object.keys(variants).sort((a, b) => (a === first ? -1 : b === first ? 1 : 0));
  for (const key of keys) {
    const css = variants[key]!;
    try {
      const png = await render(node, { width: 720, height: 400, css: [root, css] });
      const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
      out[key] = [...bytes];
    } catch {
      out[key] = [];
    }
  }
  return out;
};

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
          // Pre-split like BalancedPixelWidthLineSplitter would (maxWidthRatio
          // 0.72): raw unsplit long lines overflow max-width:92% in Takumi
          // while the probe's indefinite container lets the browser overflow,
          // a pure harness artifact either way. Production never sees it.
          lines: [
            new Line({ words: [w('Sphinx', 3, 3.6), w('of', 3.6, 4), w('black', 4, 4.6)] }),
            new Line({ words: [w('quartz,', 4.6, 5.2), w('judge', 5.2, 5.5)] }),
          ],
          customTime: new TimeFragment(3, 5.5),
        }),
      ],
    })],
  });
  return matrixDoc;
}

async function matrixFonts(name: string): Promise<TakumiFontSet & { family: string; loaded: boolean; browserLoaded: boolean }> {
  const family = galleryFontFamily(name);
  const cached = matrixFontCache.get(family);
  if (cached !== undefined) {
    return { fonts: cached, family, loaded: true, browserLoaded: true, hasItalic: fontSetHasItalic(cached) };
  }
  // Local subset files (cli/fetch-fonts.ts): deterministic, no per-run CDN.
  try {
    const manifest = (await (await fetch('/input/fonts/manifest.json')).json()) as Record<string, Array<{
      file: string;
      name: string;
      subsetOf: string;
      weight?: number;
      style?: string;
      ranges: ReadonlyArray<readonly [number, number]>;
    }>>;
    const entries = manifest[family];
    if (entries && entries.length > 0) {
      const fonts: unknown[] = [];
      for (const entry of entries) {
        const bytes = new Uint8Array(await (await fetch(`/input/fonts/${entry.file}`)).arrayBuffer());
        const buf: ArrayBuffer = bytes.buffer as ArrayBuffer;
        // Same shape googleFonts returns: subsets route by ranges, and the
        // backend skips files it already has via the thunk.
        fonts.push({
          name: entry.name,
          subsetOf: entry.subsetOf,
          weight: entry.weight,
          style: entry.style,
          ranges: entry.ranges,
          data: () => Promise.resolve(buf),
        });
      }
      matrixFontCache.set(family, fonts);
      let browserLoaded = false;
      try {
        for (const entry of entries) {
          const range = entry.ranges.map(([a, b]) => `U+${a.toString(16).toUpperCase()}-${b.toString(16).toUpperCase()}`).join(',');
          const descriptors: FontFaceDescriptors = {
            weight: entry.weight === undefined ? 'normal' : String(entry.weight),
            style: entry.style ?? 'normal',
            ...(range === '' ? {} : { unicodeRange: range }),
          };
          const face = new FontFace(entry.subsetOf, await (await fetch(`/input/fonts/${entry.file}`)).arrayBuffer(), descriptors);
          await face.load();
          document.fonts.add(face);
        }
        await document.fonts.ready;
        browserLoaded = true;
      } catch {
        // Browser side stays fallback; Takumi side still exact.
      }
      return { fonts, family, loaded: true, browserLoaded, hasItalic: fontSetHasItalic(fonts) };
    }
  } catch {
    // Fall through to the CDN helper.
  }
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
        // Wait for the swap to finish: measuring before fonts.ready reads
        // fallback-metric layout and poisons every comparison after it.
        await document.fonts.ready;
        browserLoaded = true;
      }
    } catch {
      // Browser side stays fallback; Takumi side still exact.
    }
    return { fonts, family, loaded: true, browserLoaded, hasItalic: fontSetHasItalic(fonts) };
  } catch {
    return { fonts: undefined, family, loaded: false, browserLoaded: false, hasItalic: false };
  }
}

/** Zero-size grid anchor mirroring SegmentWrapperRenderer.composeAnchorStyle. */
function buildGalleryAnchor(name: string): string {
  const json = (galleryTemplateJson(name) as {
    alignment: { verticalAlign: string; verticalOffset: number; horizontalAlign?: string; horizontalOffset?: number };
  }).alignment;
  const yPx = Math.round(json.verticalOffset * 1280);
  const hAlign = json.horizontalAlign ?? 'center';
  const hOffset = json.horizontalOffset ?? 0.5;
  const hSide = hAlign === 'left' || hAlign === 'start' ? 'left' : hAlign === 'right' || hAlign === 'end' ? 'right' : 'center';
  const xPx = hSide === 'left' ? Math.round(hOffset * 720) : hSide === 'right' ? Math.round(hOffset * 720) : 360;
  const vGridAlign = json.verticalAlign === 'top' ? 'start' : json.verticalAlign === 'center' ? 'center' : 'end';
  const hGridAlign = hSide === 'left' ? 'start' : hSide === 'right' ? 'end' : 'center';
  return `position:absolute;top:${yPx}px;left:${xPx}px;width:0;height:0;display:grid;grid-template:0 / 0;align-items:${vGridAlign};justify-items:${hGridAlign};`;
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
  // Two flavors of the same template: browser-exact values for truth,
  // Takumi-baked values (fallbacks) for the renderer under test. Sharing
  // one flavor would hand one side wrong inline vars.
  const font = await matrixFonts(name);
  const styleB = buildGalleryStyle(name, 720, 1280);
  const styleT = buildGalleryStyle(name, 720, 1280, { takumi: true, hasItalic: font.hasItalic });
  const layered = galleryUsesSvgFilter(name);
  const renderReal = async (node: string, css: string[], timeMs: number): Promise<Uint8Array> => {
    const out = await render(node, {
      width: 720,
      height: 1280,
      css: [...css],
      timeMs,
      ...(font.fonts === undefined ? {} : { fonts: font.fonts as never[] }),
    });
    return out instanceof Uint8Array ? out : new Uint8Array(out);
  };
  // --- Takumi side (production code path) ---
  let takumi: MatrixCaseResult['takumi'];
  let capturedT = { node: '', css: [] as string[] };
  try {
    const takumiRender: TakumiRenderFn = async (node, options) => {
      capturedT = { node, css: [...options.css] };
      return renderReal(node, [...options.css], options.timeMs);
    };
    const renderer = new TakumiSubtitleFrameRenderer(takumiRender, {
      ...(font.fonts === undefined ? {} : { fonts: font.fonts }),
      layeredOutline: layered,
    });
    await renderer.open(doc, { matrix: styleT }, 720, 1280);
    const [frame] = await renderer.getFrames([t]);
    renderer.close();
    if (!frame) throw new Error('no frame (nothing active)');
    // Re-render once capturing PNG bytes for the driver to analyze.
    const bytes = await renderReal(capturedT.node, capturedT.css, Math.round(t * 1000));
    takumi = { png: [...bytes] };
  } catch (err) {
    takumi = { error: err instanceof Error ? err.message : String(err) };
  }
  // --- Browser side (browser-exact node+css, animations frozen at timeMs) ---
  // Anchored exactly like SegmentWrapperRenderer: a zero-size grid at the
  // anchor point places the caption without transforms. Without this,
  // bottom/center templates would sit in static flow (top) while Takumi
  // honors the anchor — a pure harness artifact, not renderer drift.
  let browser: MatrixCaseResult['browser'];
  let capturedB = { node: '', css: [] as string[] };
  try {
    // Recapture the node under browser-exact inline vars. The bytes are
    // irrelevant here; reuse the Takumi PNG so decode always succeeds.
    const reuseBytes = takumi && 'png' in takumi && takumi.png.length > 0
      ? new Uint8Array(takumi.png)
      : new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const captureRender: TakumiRenderFn = async (node, options) => {
      capturedB = { node, css: [...options.css] };
      return reuseBytes;
    };
    const captureRenderer = new TakumiSubtitleFrameRenderer(captureRender, { layeredOutline: layered });
    await captureRenderer.open(doc, { matrix: styleB }, 720, 1280);
    await captureRenderer.getFrames([t]);
    captureRenderer.close();
    if (capturedB.node === '') throw new Error('no node captured');
    const probe = ensureMatrixProbe();
    probe.innerHTML = '';
    const anchor = buildGalleryAnchor(name);
    const styleEl = document.createElement('style');
    // Neutralize the Takumi root/layer boxes inside the probe: the anchor
    // owns positioning here, and background on layers would double-paint.
    // The caption subtree keeps every template class, var, and animation.
    styleEl.textContent = `${capturedB.css.join('\n')}\n` +
      '.tscaps-takumi-root{position:static !important;width:max-content !important;height:auto !important;background:transparent !important;}' +
      '.tscaps-takumi-layer{position:static !important;width:auto !important;height:auto !important;display:block !important;padding:0 !important;background:transparent !important;}';
    probe.appendChild(styleEl);
    const anchorEl = document.createElement('div');
    anchorEl.setAttribute('style', anchor);
    anchorEl.innerHTML = capturedB.node;
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
  return { name, t, takumi, browser, font: { family: font.family, loaded: font.loaded, browserLoaded: font.browserLoaded, hasItalic: font.hasItalic } };
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
