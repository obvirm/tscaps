import type { AppError } from '@core/errors/domain/AppError';
import type { AppErrorName } from '@core/errors/domain/AppErrorName';

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
 * Notices published while nobody is listening are held and handed to
 * the next listener to subscribe, in the order they arrived. Anomalies
 * are often detected during a long-running phase that owns the whole
 * viewport, so the surface that would show them does not exist yet;
 * without the hold, exactly the notices worth showing would be the
 * ones dropped.
 *
 * One notice is held per failure kind. A phase can produce several
 * unrelated ones — a video that could not be kept and a proxy that
 * could not be built are different things to say — and holding a
 * single slot silently loses whichever came first. Keying by `name`
 * bounds what is held to the number of distinct failures the app can
 * report, and keeps the newest of any kind that repeats, which is the
 * one whose `cause` describes the state the reader is in.
 */
export class AppNoticeChannel {
  private readonly listeners = new Set<AppNoticeListener>();
  private readonly undelivered = new Map<AppErrorName, AppError>();

  subscribe(listener: AppNoticeListener): () => void {
    this.listeners.add(listener);
    this.drainTo(listener);
    return () => { this.listeners.delete(listener); };
  }

  publish(error: AppError): void {
    if (this.listeners.size === 0) {
      this.undelivered.set(error.name, error);
      return;
    }
    for (const listener of this.listeners) listener(error);
  }

  private drainTo(listener: AppNoticeListener): void {
    if (this.undelivered.size === 0) return;
    const held = [...this.undelivered.values()];
    this.undelivered.clear();
    for (const error of held) listener(error);
  }
}
