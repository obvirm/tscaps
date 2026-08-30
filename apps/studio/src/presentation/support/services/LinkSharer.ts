import type { TextClipboard } from '@presentation/support/services/TextClipboard';

export type ShareOutcome = 'shared' | 'copied' | 'unavailable';

export interface SharePayload {
  readonly url: string;
  readonly title: string;
  readonly text: string;
}

/**
 * Shares a link the way the current browser supports it. Prefers the
 * Web Share API (native picker on mobile / share-capable desktops) and
 * falls back to copying the URL to the clipboard. Returns `unavailable`
 * only when neither path works — in that case, the caller shows the
 * URL as plain text so the user can copy it by hand.
 *
 * Never throws. Web Share rejects when the user dismisses the sheet,
 * and that's treated as "not shared, try the clipboard".
 */
export class LinkSharer {
  constructor(private readonly clipboard: TextClipboard) {}

  async share(payload: SharePayload): Promise<ShareOutcome> {
    if (this.canUseWebShare()) {
      const shared = await this.tryWebShare(payload);
      if (shared) return 'shared';
    }
    const copied = await this.clipboard.copy(payload.url);
    return copied ? 'copied' : 'unavailable';
  }

  private canUseWebShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  private async tryWebShare(payload: SharePayload): Promise<boolean> {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return true;
    } catch {
      return false;
    }
  }
}
