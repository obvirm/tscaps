import {
  RenderPipelineBuilder,
  TakumiSubtitleFrameRenderer,
  GapFreeEffect,
  SmartPunctuationEffect,
  Document,
  Section,
  Segment,
  Line,
  Word,
  TimeFragment,
  type PipelineProgressEvent,
  type TakumiRenderFn,
  type TakumiBitmapDecoder,
} from '@tscaps/engine';
import { render } from 'takumi-js';
import { buildPicoStyle } from './pico-style';

declare global {
  interface Window {
    renderE2E(videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: 'default' | 'pico'): Promise<void>;
    takumiProbe(): Promise<number>;
    picoProbe(): Promise<{ bytes: number; magic: string; data: number[] }>;
    picoSweep(): Promise<{ failures: string[]; data: number[] }>;
  }
}

// Full stock pipeline on a real video. The ONLY seam under experiment is
// the subtitle frame renderer: Takumi versus the stock browser renderer.
// Transcription (Whisper bawaan), splitting, tagging, effects, compositing,
// and muxing are identical in both runs. Pico applies the real gallery
// template (template.json controls + compiled CSS + JetBrains Mono),
// resolved at the render size exactly as the browser would compute it.
window.renderE2E = async (videoUrl: string, fontUrl: string | null, renderer: 'takumi' | 'browser', style: 'default' | 'pico') => {
  const inputBlob = await (await fetch(videoUrl)).blob();
  const probe = await probeDimensions(inputBlob);
  const builder = new RenderPipelineBuilder().withInputVideo(inputBlob);

  if (style === 'pico') {
    builder
      .withSubtitleStyle(buildPicoStyle(probe.width, probe.height))
      .withDefaultLineSplitterConfig({ maxLines: 3, minLines: 1, maxWidthRatio: 0.72 })
      .addEffect(new GapFreeEffect())
      .addEffect(new SmartPunctuationEffect());
  }
  if (renderer === 'takumi') {
    // Adapter: engine's injectable signature over takumi-js's union options.
    // Validates PNG magic so a corrupt/empty backend output fails loud with
    // its timestamp instead of dying later inside createImageBitmap.
    const takumiRender: TakumiRenderFn = async (node, options) => {
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
    // Local font bytes (served by the driver): no per-render CDN fetches.
    const fonts = fontUrl === null
      ? undefined
      : [{ name: 'JetBrains Mono', data: new Uint8Array(await (await fetch(fontUrl)).arrayBuffer()) }];
    const decode: TakumiBitmapDecoder = async (png) => {
      const blob = new Blob([png as unknown as BlobPart], { type: 'image/png' });
      try {
        return await createImageBitmap(blob);
      } catch (err) {
        const magic = [...png.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
        const view = new DataView(png.buffer, png.byteOffset, Math.min(png.byteLength, 33));
        const ihdr = png.length >= 33
          ? `w=${view.getUint32(16)} h=${view.getUint32(20)} depth=${view.getUint8(24)} ctype=${view.getUint8(25)}`
          : 'short';
        throw new Error(`decode failed: ${png.length} bytes, magic ${magic}, ${ihdr}: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    builder.withSubtitleFrameRenderer(
      new TakumiSubtitleFrameRenderer(takumiRender, { ...(fonts === undefined ? {} : { fonts }), decode }),
    );
  }
  const pipeline = builder.build();
  const result = await pipeline.run((event) => console.log(describeProgressEvent(event)));
  if (result.blob === null) throw new Error('Pipeline returned no blob');
  triggerBrowserDownload(result.blob, `output-${renderer}-${style}.mp4`);
};

// One Pico frame through the style path (built-in font; network-free).
window.picoProbe = async () => {
  const style = buildPicoStyle(720, 1280);
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
  const style = buildPicoStyle(720, 1280);
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
