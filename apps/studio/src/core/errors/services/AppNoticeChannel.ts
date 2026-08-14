import type { AppError } from '@core/errors/domain/AppError';

export type AppNoticeListener = (error: AppError) => void;

/**
 * Broadcast channel for non-blocking user notices carried as
 * {@link AppError} instances. Reporters detect and publish; UI
 * surfaces subscribe and decide how to show. Complements the
 * store's blocking `error` slot: notices coexist rather than
 * override, and any surface can filter for the subset it cares
 * about via `error.name`.
 *
 * Listeners are invoked synchronously in registration order.
 *
 * A notice published while nobody is listening is held and handed to
 * the next listener to subscribe. Anomalies are often detected during
 * a long-running phase that owns the whole viewport, so the surface
 * that would show the notice does not exist yet; without the hold,
 * exactly the notices worth showing would be the ones dropped. Only
 * the most recent one is kept, and it is delivered once.
 */
export class AppNoticeChannel {
  private readonly listeners = new Set<AppNoticeListener>();
  private undelivered: AppError | null = null;

  subscribe(listener: AppNoticeListener): () => void {
    this.listeners.add(listener);
    this.drainTo(listener);
    return () => { this.listeners.delete(listener); };
  }

  publish(error: AppError): void {
    if (this.listeners.size === 0) {
      this.undelivered = error;
      return;
    }
    for (const listener of this.listeners) listener(error);
  }

  private drainTo(listener: AppNoticeListener): void {
    const held = this.undelivered;
    if (!held) return;
    this.undelivered = null;
    listener(held);
  }
}
