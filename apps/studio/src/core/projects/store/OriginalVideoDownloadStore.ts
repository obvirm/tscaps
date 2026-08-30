import type { AppError } from '@core/errors/domain/AppError';
import type { OriginalVideoDownloadStatus } from '@core/projects/domain/OriginalVideoDownloadStatus';

const IDLE: OriginalVideoDownloadStatus = { kind: 'idle' };

/**
 * Observable container for the active project's original-video fetch.
 * Mutations emit a `'change'` event so subscribers can repaint a
 * progress indicator, surface a banner, or release a coroutine that
 * was waiting for the bytes to land.
 *
 * Kept independent of the editor store on purpose: progress ticks
 * happen tens or hundreds of times per fetch, and routing them
 * through the editor store would force unrelated subscribers to
 * re-render on each one.
 */
export class OriginalVideoDownloadStore extends EventTarget {
  private _status: OriginalVideoDownloadStatus = IDLE;

  get status(): OriginalVideoDownloadStatus {
    return this._status;
  }

  /** Resets the store back to `idle`, e.g. on project switch. */
  reset(): void {
    if (this._status.kind === 'idle') return;
    this.publish(IDLE);
  }

  /** Marks the start of a fetch. Progress begins as unknown. */
  start(): void {
    this.publish({ kind: 'downloading', progress: null });
  }

  /**
   * Updates the active fetch's progress fraction. `null` signals the
   * transport could not advertise a total size; consumers fall back
   * to an indeterminate indicator. No-op when no fetch is in flight.
   */
  setProgress(progress: number | null): void {
    if (this._status.kind !== 'downloading') return;
    const next = progress === null ? null : this.clamp01(progress);
    if (this._status.progress === next) return;
    this.publish({ kind: 'downloading', progress: next });
  }

  /** Marks the fetch as complete and the bytes published. */
  markReady(): void {
    if (this._status.kind === 'ready') return;
    this.publish({ kind: 'ready' });
  }

  /**
   * Marks the fetch as failed, carrying the error that ended it.
   * Keeps the failure it already holds: every retry starts from
   * `start()`, so a second failure only ever arrives after the status
   * has left this state.
   */
  fail(error: AppError): void {
    if (this._status.kind === 'failed') return;
    this.publish({ kind: 'failed', error });
  }

  /**
   * Resolves once the status reaches `'ready'`. Rejects when it
   * reaches `'failed'`. Resolves immediately when already ready,
   * rejects immediately when already failed.
   */
  waitUntilReady(): Promise<void> {
    if (this._status.kind === 'ready') return Promise.resolve();
    if (this._status.kind === 'failed') return Promise.reject(this._status.error);
    return this.subscribeUntilTerminal();
  }

  private subscribeUntilTerminal(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const listener = () => {
        if (this._status.kind === 'ready') {
          this.removeEventListener('change', listener);
          resolve();
          return;
        }
        if (this._status.kind === 'failed') {
          this.removeEventListener('change', listener);
          reject(this._status.error);
        }
      };
      this.addEventListener('change', listener);
    });
  }

  private publish(status: OriginalVideoDownloadStatus): void {
    this._status = status;
    this.dispatchEvent(new Event('change'));
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
