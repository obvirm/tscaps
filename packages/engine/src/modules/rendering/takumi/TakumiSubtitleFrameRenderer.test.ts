import { describe, expect, it, vi } from 'vitest';
import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { TakumiRenderFn } from '@modules/rendering/takumi/TakumiRenderFn';
import { TakumiSubtitleFrameRenderer } from '@modules/rendering/takumi/TakumiSubtitleFrameRenderer';

function style(overrides?: Partial<SubtitleStyle>): SubtitleStyle {
  return {
    css: '.segment{color:#fff;} .word{font-size:48px;}',
    inlineStyles: { '--tscaps-font-size': '48px' },
    alignment: {
      verticalAlign: 'bottom',
      verticalOffset: 0.9,
      horizontalAlign: 'center',
      horizontalOffset: 0.5,
    },
    rendering: {
      splitWordsIntoLetters: false,
      videoFrame: { required: false, jpegQuality: 0.8 },
      padding: null,
      textDirection: 'ltr',
    },
    ...overrides,
  };
}

function doc(): Document {
  const words = [
    new Word({ text: 'hello', time: new TimeFragment(0, 1) }),
    new Word({ text: 'world', time: new TimeFragment(1, 2) }),
  ];
  const segment = new Segment({
    lines: [new Line({ words })],
    customTime: new TimeFragment(0, 2),
  });
  return new Document({ sections: [new Section({ segments: [segment], kind: 'default' })] });
}

const renderStub = (): TakumiRenderFn => (async () => new Uint8Array([1, 2, 3]));
const stubBitmap = {} as CanvasImageSource;

describe('TakumiSubtitleFrameRenderer', () => {
  it('returns null where no segment is active', async () => {
    const render = vi.fn(renderStub());
    const renderer = new TakumiSubtitleFrameRenderer(render, { decode: async () => stubBitmap });
    await renderer.open(doc(), { default: style() }, 1280, 720);
    expect(await renderer.getFrames([5])).toEqual([null]);
    expect(render).not.toHaveBeenCalled();
    renderer.close();
  });

  it('renders active timestamps to drawable frames via the injected render fn', async () => {
    const render = vi.fn(renderStub());
    const renderer = new TakumiSubtitleFrameRenderer(render, { decode: async () => stubBitmap });
    await renderer.open(doc(), { default: style() }, 1280, 720);
    const [frame] = await renderer.getFrames([0.1]);
    expect(frame).not.toBeNull();
    expect(render).toHaveBeenCalledTimes(1);
    const call = render.mock.calls[0];
    expect(call).toBeDefined();
    const [node, options] = call!;
    expect(typeof node).toBe('string');
    expect(node).toContain('hello');
    expect(options.width).toBe(1280);
    expect(options.height).toBe(720);
    expect(options.timeMs).toBe(100);
    expect(options.css.some((s: string) => s.includes('.segment'))).toBe(true);
    // bottom anchor at 0.9 of 720px → 72px bottom padding.
    expect(options.css.some((s: string) => s.includes('padding-bottom:72.0px'))).toBe(true);
    const drawImage = vi.fn();
    frame!.draw({ drawImage } as unknown as CanvasRenderingContext2D, 0, 0, 1280, 720);
    expect(drawImage).toHaveBeenCalledTimes(1);
    renderer.close();
  });

  it('dedups timestamps that share one frame slot and visual state', async () => {
    const render = vi.fn(renderStub());
    const renderer = new TakumiSubtitleFrameRenderer(render, { decode: async () => stubBitmap });
    await renderer.open(doc(), { default: style() }, 1280, 720);
    // Same 1/30s slot, same word states → one PNG render.
    const frames = await renderer.getFrames([0.1, 0.11]);
    expect(frames[0]).not.toBeNull();
    expect(frames[1]).not.toBeNull();
    expect(render).toHaveBeenCalledTimes(1);
    renderer.close();
  });

  it('renders animation progress across frame slots separately', async () => {
    const render = vi.fn(renderStub());
    const renderer = new TakumiSubtitleFrameRenderer(render, { decode: async () => stubBitmap });
    await renderer.open(doc(), { default: style() }, 1280, 720);
    await renderer.getFrames([0.1, 0.2]);
    expect(render).toHaveBeenCalledTimes(2);
    renderer.close();
  });

  it('rejects styles that require a video frame', async () => {
    const renderer = new TakumiSubtitleFrameRenderer(renderStub());
    await expect(
      renderer.open(
        doc(),
        { default: style({ rendering: {
          splitWordsIntoLetters: false,
          videoFrame: { required: true, jpegQuality: 0.8 },
          padding: null,
          textDirection: 'ltr',
        } }) },
        1280,
        720,
      ),
    ).rejects.toThrow(/video frame/);
  });

  it('caps batches because every tile is a full PNG render', async () => {
    const renderer = new TakumiSubtitleFrameRenderer(renderStub());
    await renderer.open(doc(), { default: style() }, 1280, 720);
    expect(await renderer.getMaxTilesPerBatch()).toBeLessThanOrEqual(8);
    renderer.close();
  });

  it('emits one layer by default and two coinciding layers with layeredOutline', async () => {
    for (const layeredOutline of [false, true]) {
      const render = vi.fn(renderStub());
      const renderer = new TakumiSubtitleFrameRenderer(render, {
        decode: async () => stubBitmap,
        layeredOutline,
      });
      await renderer.open(doc(), { default: style() }, 1280, 720);
      await renderer.getFrames([0.1]);
      const call = render.mock.calls[0];
      expect(call).toBeDefined();
      const [node] = call!;
      const layers = node.split('tscaps-takumi-layer').length - 1;
      expect(layers).toBe(layeredOutline ? 2 : 1);
      if (layeredOutline) {
        expect(node).toContain('tscaps-takumi-outline');
        expect(node).toContain('tscaps-takumi-fill');
      }
      renderer.close();
    }
  });
});
