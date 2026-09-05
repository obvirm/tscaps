import type { Document } from '@modules/document/Document';
import type { Segment } from '@modules/document/Segment';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { VideoFrameSource } from '@modules/rendering/types/VideoFrameSource';
import type { TakumiBitmapDecoder, TakumiRenderFn } from '@modules/rendering/takumi/TakumiRenderFn';

/**
 * `SubtitleFrameRenderer` backed by Takumi instead of the browser engine.
 *
 * Image-sequence model: each distinct visual state renders once to a
 * transparent full-frame PNG; the PNG decodes to a bitmap that paints
 * through `SubtitleFrame.draw`, the same contract the MediaBunny painter
 * consumes. Nothing else in the pipeline changes — transcription,
 * splitting, tagging, effects, compositing, and muxing stay stock.
 *
 * Known gaps versus `BrowserSubtitleFrameRenderer` (fidelity work, not
 * architecture work):
 * - dedup key is active-segment ids + word states. Time-driven CSS
 *   (`--word-being-narrated-starts`, keyframes, mount animations) and
 *   SVG-filter state are not fingerprinted;
 * - alignment maps onto a row-direction flex root; absolute
 *   `verticalOffset`/`horizontalOffset` anchors are approximated;
 * - `videoFrame.required` styles are rejected — no video-frame binding;
 * - fonts are whatever Takumi is given (built-in Latin fallback unless
 *   `fonts` are supplied); `CssResourceEmbedder` inlining is not wired;
 * - container-query units (`cqw`/`cqh`) and other Chrome-only CSS render
 *   as Takumi's ~160-property subset dictates.
 */
export class TakumiSubtitleFrameRenderer implements SubtitleFrameRenderer {
  private doc: Document | null = null;
  private styles: Record<string, SubtitleStyle> = {};
  private width = 0;
  private height = 0;
  private readonly cache = new Map<string, SubtitleFrame>();

  constructor(
    private readonly render: TakumiRenderFn,
    private readonly decode: TakumiBitmapDecoder = defaultDecode,
  ) {}

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
    this.cache.clear();
  }

  async getMaxTilesPerBatch(): Promise<number> {
    // No sprite sheet: every tile costs one full PNG render.
    return 8;
  }

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    if (!this.doc || timestamps.length === 0) return timestamps.map(() => null);
    // Prefix semantics per the interface: cover timestamps until the
    // picture budget runs out; the caller advances by the returned length.
    // Cached pictures cost no budget.
    const maxTiles = await this.getMaxTilesPerBatch();
    const keys = timestamps.map((t) => this.cacheKey(t));
    let end = 0;
    const toRender = new Map<string, number>();
    for (; end < timestamps.length; end++) {
      const key = keys[end]!;
      if (key === null) continue;
      if (this.cache.has(key) || toRender.has(key)) continue;
      if (toRender.size >= maxTiles) break;
      toRender.set(key, end);
    }
    await Promise.all(
      [...toRender.entries()].map(async ([key, i]) => {
        const frame = await this.renderAt(timestamps[i]!);
        if (frame) this.cache.set(key, frame);
      }),
    );
    const covered = end === 0 ? 1 : end;
    return timestamps.slice(0, covered).map((_, i) => {
      const key = keys[i]!;
      if (key === null) return null;
      return this.cache.get(key) ?? null;
    });
  }

  close(): void {
    this.doc = null;
    this.styles = {};
    this.cache.clear();
  }

  private cacheKey(t: number): string | null {
    const active = this.doc!.getActiveSegments(t);
    if (active.length === 0) return null;
    // State-only key matches what buildNode emits (state classes, no
    // time-relative vars). See class doc for what this leaves out.
    return active
      .map((seg) => `${seg.id}:${seg.getWords().map((w) => w.getState(t)).join(',')}`)
      .sort()
      .join('|');
  }

  private async renderAt(t: number): Promise<SubtitleFrame | null> {
    const active = this.doc!.getActiveSegments(t);
    if (active.length === 0) return null;
    const node = this.buildNode(active, t);
    const css = this.buildCss();
    const png = await this.render(node, { width: this.width, height: this.height, css });
    const bitmap = await this.decode(png);
    return {
      draw: (ctx, dx, dy, dWidth, dHeight) => {
        ctx.drawImage(bitmap, dx, dy, dWidth, dHeight);
      },
    };
  }

  private buildCss(): string[] {
    // Row-direction flex root: justify-content runs horizontally,
    // align-items runs vertically.
    const positioning = [
      '.tscaps-takumi-root{width:100%;height:100%;display:flex;',
      `justify-content:${this.horizontalJustify()};align-items:${this.verticalAlignItems()};`,
      'background:transparent;}',
      '.tscaps-takumi-caption{max-width:92%;background:transparent;}',
    ].join('');
    return [positioning, ...Object.values(this.styles).map((s) => s.css)];
  }

  private verticalAlignItems(): string {
    const align = Object.values(this.styles)[0]?.alignment.verticalAlign ?? 'bottom';
    return align === 'top' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end';
  }

  private horizontalJustify(): string {
    const align = Object.values(this.styles)[0]?.alignment.horizontalAlign ?? 'center';
    return align === 'left' || align === 'start' ? 'flex-start'
      : align === 'right' || align === 'end' ? 'flex-end'
      : 'center';
  }

  private buildNode(active: Segment[], t: number): string {
    const captionVars = this.serializeVars(Object.values(this.styles)[0]?.inlineStyles ?? {});
    const segments = active.map((seg) => this.buildSegment(seg, t)).join('');
    return `<div class="tscaps-takumi-root"><div class="tscaps-takumi-caption" style="${captionVars}">${segments}</div></div>`;
  }

  private buildSegment(seg: Segment, t: number): string {
    const segClasses = escapeAttr(seg.getCssClasses(t).join(' '));
    const lines = seg.lines
      .map((line) => {
        const lineClasses = escapeAttr(line.getCssClasses(t).join(' '));
        const words = line.words
          .map((word) => {
            const wordClasses = escapeAttr(word.getCssClasses(t).join(' '));
            return `<span class="${wordClasses}">${escapeHtml(word.displayText)}</span>`;
          })
          .join(' ');
        return `<div class="${lineClasses}">${words}</div>`;
      })
      .join('');
    return `<div class="${segClasses}">${lines}</div>`;
  }

  private serializeVars(vars: Readonly<Record<string, string>>): string {
    return Object.entries(vars)
      .map(([k, v]) => `${escapeAttr(k)}:${escapeAttr(v)};`)
      .join(' ');
  }
}

async function defaultDecode(png: Uint8Array): Promise<CanvasImageSource> {
  const blob = new Blob([png as unknown as BlobPart], { type: 'image/png' });
  return createImageBitmap(blob);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
