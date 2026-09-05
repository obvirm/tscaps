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
import { buildGalleryStyle, gallerySegmentSplitter, galleryEffects, galleryMaxLines, galleryFontFamily, type GalleryTemplateName } from './gallery-style';

export type RunnerStyle = 'default' | GalleryTemplateName;

declare global {
  interface Window {
    renderE2E(videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: RunnerStyle): Promise<void>;
    transcribeOnly(videoUrl: string, style: RunnerStyle): Promise<DocJson>;
    renderFromDocument(videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: RunnerStyle, doc: DocJson): Promise<void>;
    takumiProbe(): Promise<number>;
    picoProbe(): Promise<{ bytes: number; magic: string; data: number[] }>;
    picoSweep(): Promise<{ failures: string[]; data: number[] }>;
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

function buildPipeline(video: Blob, style: RunnerStyle, probe: { width: number; height: number }) {
  const builder = new RenderPipelineBuilder().withInputVideo(video);
  if (style !== 'default') {
    builder
      .withSubtitleStyle(buildGalleryStyle(style, probe.width, probe.height))
      .withSegmentSplitter(gallerySegmentSplitter(style))
      .withDefaultLineSplitterConfig({ maxLines: galleryMaxLines(style), minLines: 1, maxWidthRatio: 0.72 })
      .withEffects(galleryEffects(style));
  }
  return builder;
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
  const builder = buildPipeline(inputBlob, style, probe);

  if (renderer === 'takumi') {
    builder.withSubtitleFrameRenderer(new TakumiSubtitleFrameRenderer(takumiAdapter(), await adapterFonts(fontUrl, style)));
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
  const builder = buildPipeline(inputBlob, style, probe);
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
  const builder = buildPipeline(inputBlob, style, probe);
  if (renderer === 'takumi') {
    builder.withSubtitleFrameRenderer(new TakumiSubtitleFrameRenderer(takumiAdapter(), await adapterFonts(fontUrl, style)));
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
