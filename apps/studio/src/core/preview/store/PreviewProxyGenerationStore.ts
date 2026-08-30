export type PreviewProxyGenerationPhase = 'idle' | 'generating' | 'failed';

/**
 * Observable state of an on-demand preview-proxy generation.
 *
 * `idle` covers both "never asked" and "finished fine" — a completed
 * generation flips the published preview to a proxy, which is what
 * consumers react to; this store only narrates the run itself.
 * `failed` sticks until the next `start`, so an affordance can show
 * the failure and offer a retry.
 *
 * Subscribers listen for `'change'` and read `phase` / `percent`.
 */
export class PreviewProxyGenerationStore extends EventTarget {

  private _phase: PreviewProxyGenerationPhase = 'idle';
  private _percent = 0;

  get phase(): PreviewProxyGenerationPhase {
    return this._phase;
  }

  get percent(): number {
    return this._percent;
  }

  start(): void {
    this._phase = 'generating';
    this._percent = 0;
    this.dispatchEvent(new Event('change'));
  }

  setProgress(progress: number): void {
    const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    if (percent === this._percent) return;
    this._percent = percent;
    this.dispatchEvent(new Event('change'));
  }

  finish(): void {
    this._phase = 'idle';
    this._percent = 0;
    this.dispatchEvent(new Event('change'));
  }

  fail(): void {
    this._phase = 'failed';
    this.dispatchEvent(new Event('change'));
  }
}
