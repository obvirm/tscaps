import type { VideoController } from '@presentation/editor/controllers/VideoController';

const NON_TEXT_INPUT_TYPES = new Set([
  'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'color',
]);

/**
 * Listens for video-navigation keyboard shortcuts and dispatches them to
 * VideoController. Uses held-key chords for navigation:
 *
 *   F + ←/→   → prev/next frame
 *   W + ←/→   → prev/next word
 *   S + ←/→   → prev/next segment
 *   ,          → slower (step down speed)
 *   .          → faster (step up speed)
 *
 * Skipped when focus is on a text-editing element.
 */
export class VideoKeyboardController {
  private readonly pressedKeys = new Set<string>();

  constructor(private readonly video: VideoController) {}

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.pressedKeys.clear();
  }

  private isTextEditingFocus(el: HTMLElement | null): boolean {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(el.type.toLowerCase());
    return false;
  }

  /**
   * Chromium's autofill dropdown dispatches synthetic KeyboardEvents
   * carrying no `key` despite the DOM type declaring one; those are not
   * keystrokes and yield `undefined`.
   */
  private normalizedKey(e: KeyboardEvent): string | undefined {
    const key: string | undefined = e.key;
    return key?.toLowerCase();
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const key = this.normalizedKey(e);
    if (key === undefined) return;
    this.pressedKeys.delete(key);
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const key = this.normalizedKey(e);
    if (key === undefined) return;
    this.pressedKeys.add(key);

    if (this.isTextEditingFocus(e.target as HTMLElement | null)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (key === 'arrowleft' || key === 'arrowright') {
      const forward = key === 'arrowright';
      if (this.pressedKeys.has('f')) {
        e.preventDefault();
        if (forward) this.video.nextFrame(); else this.video.prevFrame();
      } else if (this.pressedKeys.has('w')) {
        e.preventDefault();
        if (forward) this.video.nextWord(); else this.video.prevWord();
      } else if (this.pressedKeys.has('s')) {
        e.preventDefault();
        if (forward) this.video.nextSegment(); else this.video.prevSegment();
      }
    } else if (key === 'arrowup') {
      e.preventDefault();
      this.video.setVolume(this.video.currentVolume() + 0.1);
    } else if (key === 'arrowdown') {
      e.preventDefault();
      this.video.setVolume(this.video.currentVolume() - 0.1);
    } else if (key === ' ') {
      e.preventDefault();
      this.video.togglePlay();
    } else if (key === ',') {
      e.preventDefault();
      this.video.changePlaybackRate(-1);
    } else if (key === '.') {
      e.preventDefault();
      this.video.changePlaybackRate(1);
    }
  };
}
