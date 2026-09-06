import type { Document } from '@modules/document/Document';
import type { Section } from '@modules/document/Section';
import type { Segment } from '@modules/document/Segment';
import type { Line } from '@modules/document/Line';
import type { Word } from '@modules/document/Word';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { VideoFrameSource } from '@modules/rendering/types/VideoFrameSource';
import type { WordSplitter } from '@modules/splitting/WordSplitter';
import { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';
import type { TakumiBitmapDecoder, TakumiRenderFn } from '@modules/rendering/takumi/TakumiRenderFn';

/** Caption ticks step at the source's frame rate up to this cap — same rationale as the MediaBunny painter. */
const CAPTION_FPS_CAP = 30;

/**
 * Dynamic font-scale recipe some templates declare as
 * `--tscaps-font-size-scale: max(1, 1 + (var(--tscaps-dynamic-font-size, D)
 * - var(--segment-char-count, …)) * F)`. Takumi evaluates max() wrong
 * (poisoning the value negative and collapsing the whole font-size to
 * medium), so the renderer computes the scale per segment in JS from the
 * same formula and emits it inline, where it wins over the stylesheet.
 * Shapes that do not match this recipe are left alone.
 */
const SCALE_RECIPE_RE = /--tscaps-font-size-scale\s*:\s*max\(\s*1\s*,\s*1\s*\+\s*\(\s*var\(--tscaps-dynamic-font-size\s*,\s*([\d.]+)\)\s*-\s*var\(--segment-char-count[^)]*\)\s*\)\s*\*\s*([\d.]+)\s*\)/;

interface ScaleRecipe {
  readonly baseline: number;
  readonly factor: number;
}

export interface TakumiSubtitleFrameRendererOptions {
  readonly decode?: TakumiBitmapDecoder;
  readonly wordSplitter?: WordSplitter;
  readonly fonts?: ReadonlyArray<unknown>;
  /**
   * Emit the caption subtree twice — a hollow outline layer under an
   * intact fill layer — mirroring an SVG `dilate + merge` filter for
   * backends that cannot run `filter: url()`. The caller pairs this with
   * CSS that makes the outline layer transparent-filled and stroked;
   * without that CSS the two layers coincide exactly and the output is
   * unchanged apart from render cost.
   */
  readonly layeredOutline?: boolean;
}

/**
 * `SubtitleFrameRenderer` backed by Takumi instead of the browser engine.
 *
 * Image-sequence model: each distinct visual state renders once to a
 * transparent full-frame PNG at the animation-timeline position `timeMs`;
 * the PNG decodes to a bitmap that paints through `SubtitleFrame.draw`,
 * the same contract the MediaBunny painter consumes. Nothing else in the
 * pipeline changes — transcription, splitting, tagging, effects,
 * compositing, and muxing stay stock.
 *
 * The emitted markup mirrors the browser path's `wrapper → segment →
 * lines → words/letters` shape with the same state classes and the same
 * engine-written timing variables (`CssVariable`), computed from the
 * `Document` model directly, so time-driven template CSS (letter
 * karaoke, `visibility` keyframes) resolves per timestamp.
 *
 * Known gaps versus `BrowserSubtitleFrameRenderer`:
 * - word order is model order with spaces; bidi fragment reordering and
 *   cursive joining detection are not applied (Latin scripts unaffected);
 * - decorations are not emitted (Whisper-produced documents have none);
 * - `videoFrame.required` styles are rejected — no video-frame binding;
 * - container-query units (`cqw`/`cqh`), CSS counters, and `:has()` depend
 *   on Takumi's subset; callers pre-resolve what they can into `css` vars.
 *
 * Memory model: every tile is one full-frame bitmap, so tiles are cached
 * only inside a single `getFrames` call (the batch that owns them, exactly
 * what the interface promises) and released afterwards. A cross-batch
 * cache would pin one 720p+ RGBA bitmap per animation slot — gigabytes
 * over a full video — and starves `createImageBitmap` to death.
 */
export class TakumiSubtitleFrameRenderer implements SubtitleFrameRenderer {
  private readonly decode: TakumiBitmapDecoder;
  private readonly wordSplitter: WordSplitter;
  private readonly fonts: ReadonlyArray<unknown> | undefined;
  private readonly layeredOutline: boolean;
  private doc: Document | null = null;
  private styles: Record<string, SubtitleStyle> = {};
  private width = 0;
  private height = 0;
  private scaleRecipe: ScaleRecipe | null = null;

  constructor(
    private readonly render: TakumiRenderFn,
    options: TakumiSubtitleFrameRendererOptions = {},
  ) {
    this.decode = options.decode ?? defaultDecode;
    this.wordSplitter = options.wordSplitter ?? new GraphemeWordSplitter();
    this.fonts = options.fonts;
    this.layeredOutline = options.layeredOutline ?? false;
  }

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    _videoFrameSource?: VideoFrameSource,
  ): Promise<void> {
    const requiring = Object.entries(styles)
      .filter(([, s]) => s.rendering.videoFrame.required)
      .map(([kind]) => kind);
    if (requiring.length > 0) {
      throw new Error(
        `TakumiSubtitleFrameRenderer cannot render kinds needing a video frame: ${requiring.join(', ')}.`,
      );
    }
    this.doc = doc;
    this.styles = { ...styles };
    this.width = width;
    this.height = height;
    this.scaleRecipe = detectScaleRecipe(styles);
  }

  async getMaxTilesPerBatch(): Promise<number> {
    // No sprite sheet: every tile costs one full PNG render.
    return 8;
  }

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    if (!this.doc || timestamps.length === 0) return timestamps.map(() => null);
    // Prefix semantics per the interface: cover timestamps until the
    // picture budget runs out; the caller advances by the returned length.
    // Dedup lives inside this call only — see the class memory model.
    const maxTiles = await this.getMaxTilesPerBatch();
    const keys = timestamps.map((t) => this.cacheKey(t));
    const tiles = new Map<string, SubtitleFrame>();
    let end = 0;
    const toRender = new Map<string, number>();
    for (; end < timestamps.length; end++) {
      const key = keys[end]!;
      if (key === null) continue;
      const cached = tiles.get(key);
      if (cached !== undefined || toRender.has(key)) continue;
      if (toRender.size >= maxTiles) break;
      toRender.set(key, end);
    }
    await Promise.all(
      [...toRender.entries()].map(async ([key, i]) => {
        const frame = await this.renderAt(timestamps[i]!);
        if (frame) tiles.set(key, frame);
      }),
    );
    const covered = end === 0 ? 1 : end;
    return timestamps.slice(0, covered).map((_, i) => {
      const key = keys[i]!;
      if (key === null) return null;
      return tiles.get(key) ?? null;
    });
  }

  close(): void {
    this.doc = null;
    this.styles = {};
  }

  private cacheKey(t: number): string | null {
    const doc = this.doc!;
    const active = doc.getActiveSegments(t);
    if (active.length === 0) return null;
    // Frame-slot quantum plus visual state: animation progress inside one
    // 1/30s slot is imperceptible, matching the pipeline's caption fps cap.
    const quantum = Math.round(t * CAPTION_FPS_CAP) / CAPTION_FPS_CAP;
    const states = active
      .map((seg) => `${seg.id}:${seg.getWords().map((w) => w.getState(t)).join(',')}`)
      .sort()
      .join('|');
    return `${quantum.toFixed(3)}@${states}`;
  }

  private async renderAt(t: number): Promise<SubtitleFrame | null> {
    const node = this.buildNode(t);
    if (node === null) return null;
    const css = this.buildCss();
    const png = await this.render(node, {
      width: this.width,
      height: this.height,
      css,
      timeMs: Math.round(t * 1000),
      ...(this.fonts !== undefined ? { fonts: this.fonts } : {}),
    });
    const bitmap = await this.decode(png);
    return {
      draw: (ctx, dx, dy, dWidth, dHeight) => {
        ctx.drawImage(bitmap, dx, dy, dWidth, dHeight);
      },
    };
  }

  private buildCss(): string[] {
    // Row-direction flex roots: justify-content runs horizontally,
    // align-items runs vertically. Anchor offsets become padding in PX on
    // the anchor side — CSS percentage padding resolves against the width,
    // never the height, so percentages would misplace the box.
    // bottom o → box bottom edge at o*H → padding-bottom (1-o)*H.
    // top o → box top edge at o*H → padding-top o*H.
    // center o → box center at o*H → padding-top (2o-1)*H / padding-bottom
    // (1-2o)*H whichever side the anchor leans to. Same mirrored on the
    // horizontal axis with W. Reading sides (start/end) read as screen
    // sides for ltr content, matching the engine resolver for ltr.
    //
    // Layers (see layeredOutline) each carry the full positioning so the
    // outline and fill copies coincide exactly.
    const first = Object.values(this.styles)[0];
    const vertical = first?.alignment.verticalAlign ?? 'bottom';
    const horizontal = first?.alignment.horizontalAlign ?? 'center';
    const verticalOffset = first?.alignment.verticalOffset ?? (vertical === 'bottom' ? 1 : 0);
    const horizontalOffset = first?.alignment.horizontalOffset ?? 0.5;
    const H = this.height;
    const W = this.width;
    const vPad = vertical === 'bottom'
      ? `padding-bottom:${((1 - verticalOffset) * H).toFixed(1)}px;`
      : vertical === 'top'
        ? `padding-top:${(verticalOffset * H).toFixed(1)}px;`
        : verticalOffset >= 0.5
          ? `padding-top:${((2 * verticalOffset - 1) * H).toFixed(1)}px;`
          : `padding-bottom:${((1 - 2 * verticalOffset) * H).toFixed(1)}px;`;
    const hSide = horizontal === 'left' || horizontal === 'start' ? 'left'
      : horizontal === 'right' || horizontal === 'end' ? 'right' : 'center';
    const hPad = hSide === 'left'
      ? `padding-left:${(horizontalOffset * W).toFixed(1)}px;`
      : hSide === 'right'
        ? `padding-right:${((1 - horizontalOffset) * W).toFixed(1)}px;`
        : horizontalOffset >= 0.5
          ? `padding-left:${((2 * horizontalOffset - 1) * W).toFixed(1)}px;`
          : `padding-right:${((1 - 2 * horizontalOffset) * W).toFixed(1)}px;`;
    const positioning = [
      '.tscaps-takumi-root{position:relative;width:100%;height:100%;background:transparent;}',
      '.tscaps-takumi-layer{position:absolute;left:0;top:0;width:100%;height:100%;display:flex;box-sizing:border-box;',
      `justify-content:${hSide === 'left' ? 'flex-start' : hSide === 'right' ? 'flex-end' : 'center'};`,
      `align-items:${vertical === 'top' ? 'flex-start' : vertical === 'center' ? 'center' : 'flex-end'};`,
      vPad,
      hPad,
      'background:transparent;}',
      '.tscaps-takumi-caption{max-width:92%;background:transparent;}',
    ].join('');
    return [positioning, ...Object.values(this.styles).map((s) => s.css)];
  }

  private buildNode(t: number): string | null {
    const doc = this.doc!;
    const sections = doc.getActiveSections(t);
    if (sections.length === 0) return null;
    const inner = sections.map((section) => this.buildSection(section, t)).join('');
    if (!this.layeredOutline) {
      return `<div class="tscaps-takumi-root"><div class="tscaps-takumi-layer"><div class="tscaps-takumi-caption">${inner}</div></div></div>`;
    }
    return `<div class="tscaps-takumi-root">` +
      `<div class="tscaps-takumi-layer tscaps-takumi-outline"><div class="tscaps-takumi-caption">${inner}</div></div>` +
      `<div class="tscaps-takumi-layer tscaps-takumi-fill"><div class="tscaps-takumi-caption">${inner}</div></div>` +
      `</div>`;
  }

  private buildSection(section: Section, t: number): string {
    const style = this.styles[section.kind];
    const segments = section.segments.filter((seg) => seg.time.contains(t));
    const indexById = new Map(section.segments.map((seg, i) => [seg.id, i] as const));
    const parts = segments.map((seg) =>
      this.buildSegment(seg, t, indexById.get(seg.id) ?? 0, style),
    );
    return parts.join('');
  }

  private buildSegment(seg: Segment, t: number, indexInSection: number, style: SubtitleStyle | undefined): string {
    const segClasses = escapeAttr(seg.getCssClasses(t).join(' '));
    const segVars = this.serializeVars(seg.getCssVariables(t, { indexInSection }));
    const captionVars = this.serializeVars(style?.inlineStyles ?? {});
    const scaleVar = this.scaleVarFor(seg);
    const lines = seg.lines
      .map((line) => this.buildLine(line, t, seg, style))
      .join('');
    return `<div class="${segClasses}" style="${segVars}${captionVars}${scaleVar}">${lines}</div>`;
  }

  private scaleVarFor(seg: Segment): string {
    if (!this.scaleRecipe) return '';
    const charCount = [...seg.getText()].length;
    const scale = Math.max(1, 1 + (this.scaleRecipe.baseline - charCount) * this.scaleRecipe.factor);
    return `--tscaps-font-size-scale:${scale.toFixed(4)};`;
  }

  private buildLine(
    line: Line,
    t: number,
    seg: Segment,
    style: SubtitleStyle | undefined,
  ): string {
    const lineClasses = escapeAttr(line.getCssClasses(t).join(' '));
    const lineVars = this.serializeVars(line.getCssVariables(t, { segTime: seg.time }));
    const words = line.words
      .map((word, indexInLine) => this.buildWord(word, t, seg, indexInLine, style))
      .join(' ');
    return `<div class="${lineClasses}" style="direction:ltr;${lineVars}">${words}</div>`;
  }

  private buildWord(
    word: Word,
    t: number,
    seg: Segment,
    indexInLine: number,
    style: SubtitleStyle | undefined,
  ): string {
    const wordClasses = escapeAttr(word.getCssClasses(t).join(' '));
    const wordVars = this.serializeVars(
      word.getCssVariables(t, { segTime: seg.time, indexInLine }),
    );
    if (!style?.rendering.splitWordsIntoLetters) {
      return `<span class="${wordClasses}" style="${wordVars}">${escapeHtml(word.displayText)}</span>`;
    }
    const letters = this.wordSplitter.split(word.displayText);
    const lettersHtml = letters
      .map((letter, i) => `<span class="letter" style="--letter-index:${i};">${escapeHtml(letter)}</span>`)
      .join('');
    const countVar = `--letter-count:${letters.length};`;
    return `<span class="${wordClasses}" style="${wordVars}${countVar}">${lettersHtml}</span>`;
  }

  private serializeVars(vars: Readonly<Record<string, string>>): string {
    return Object.entries(vars)
      .map(([k, v]) => `${escapeAttr(k)}:${escapeAttr(v)};`)
      .join('');
  }
}
async function defaultDecode(png: Uint8Array): Promise<CanvasImageSource> {
  const blob = new Blob([png as unknown as BlobPart], { type: 'image/png' });
  return createImageBitmap(blob);
}

function detectScaleRecipe(styles: Readonly<Record<string, SubtitleStyle>>): ScaleRecipe | null {
  for (const style of Object.values(styles)) {
    const match = SCALE_RECIPE_RE.exec(style.css);
    if (match?.[1] !== undefined && match?.[2] !== undefined) {
      return { baseline: Number(match[1]), factor: Number(match[2]) };
    }
  }
  return null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
