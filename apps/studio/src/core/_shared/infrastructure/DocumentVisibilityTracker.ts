import type { VisibilitySpan, VisibilityTracker } from '@core/_shared/domain/VisibilityTracker';

/**
 * `VisibilityTracker` backed by the DOM document's `visibilitychange`
 * event. A span opened while the page is already hidden reports
 * `wasHidden` from the start.
 */
export class DocumentVisibilityTracker implements VisibilityTracker {

  begin(): VisibilitySpan {
    let hiddenSeen = document.visibilityState === 'hidden';
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') hiddenSeen = true;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return {
      get wasHidden() { return hiddenSeen; },
      get currentState() { return document.visibilityState; },
      end: () => document.removeEventListener('visibilitychange', onVisibilityChange),
    };
  }
}
