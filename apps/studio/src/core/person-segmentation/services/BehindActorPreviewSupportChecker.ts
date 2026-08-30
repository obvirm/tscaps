import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Answers whether the session can render the text-behind-actor effect
 * on the video it currently holds. The effect samples source pixels
 * from a canvas only the proxy-playing surface owns, so the answer is
 * whether the preview is a proxy.
 *
 * Reads the published preview, not the surface's variant: the
 * surface follows the preview, so the preview is the same fact one
 * step earlier, known while a project is still loading. Never
 * cached — an on-demand generation flips the answer mid-session.
 */
export class BehindActorPreviewSupportChecker {

  constructor(
    private readonly proxyPipelineEnabled: boolean,
    private readonly editorStore: EditorStore,
  ) {}

  isSupported(): boolean {
    return this.proxyPipelineEnabled && this.editorStore.snapshot().video.preview?.kind === 'proxy';
  }
}
