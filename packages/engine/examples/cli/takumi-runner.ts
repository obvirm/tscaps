import { RenderPipelineBuilder, TakumiSubtitleFrameRenderer, type PipelineProgressEvent } from '@tscaps/engine';
import { render } from 'takumi-js';

declare global {
  interface Window {
    renderE2E(videoUrl: string, useTakumi: boolean): Promise<void>;
    takumiProbe(): Promise<number>;
  }
}

// Probe of the exact import the renderer uses. Resolves with PNG bytes.
window.takumiProbe = async () => {
  const png = await render(`<div style="width:100%;height:100%;background:transparent;"><span>smoke</span></div>`, {
    width: 64,
    height: 64,
    css: ['span{color:#fff;font-size:20px;}'],
  });
  return png.length;
};

// Full stock pipeline on a real video. The ONLY seam under experiment is
// the subtitle frame renderer: Takumi when useTakumi, otherwise the stock
// browser renderer. Transcription (Whisper bawaan), splitting, tagging,
// effects, compositing, and muxing are identical in both runs.
window.renderE2E = async (videoUrl: string, useTakumi: boolean) => {
  const inputBlob = await (await fetch(videoUrl)).blob();
  const builder = new RenderPipelineBuilder().withInputVideo(inputBlob);
  if (useTakumi) {
    builder.withSubtitleFrameRenderer(new TakumiSubtitleFrameRenderer(render));
  }
  const pipeline = builder.build();
  const result = await pipeline.run((event) => console.log(describeProgressEvent(event)));
  if (result.blob === null) throw new Error('Pipeline returned no blob');
  triggerBrowserDownload(result.blob, useTakumi ? 'output-takumi.mp4' : 'output-baseline.mp4');
};

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
