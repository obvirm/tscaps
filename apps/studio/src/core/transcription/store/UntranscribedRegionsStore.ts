import type { UntranscribedRegion } from '@tscaps/engine';
import type { TranscribeModel } from '@core/transcription/domain/TranscribePreference';

/**
 * What a local transcription run left untranscribed, together with the
 * model that produced it — copy that names the model needs the one the
 * run actually used, not whatever the preference says later.
 */
export interface UntranscribedRegionsNotice {
  readonly regions: ReadonlyArray<UntranscribedRegion>;
  readonly model: TranscribeModel;
}

/**
 * Observable holder for the pending untranscribed-regions notice of
 * the most recent local transcription run.
 *
 * The notice survives until cleared, so a consumer that mounts after
 * the run completes still sees it. Publishing replaces any previous
 * notice. Subscribers listen for the `'change'` event and read
 * `notice`.
 */
export class UntranscribedRegionsStore extends EventTarget {
  private _notice: UntranscribedRegionsNotice | null = null;

  get notice(): UntranscribedRegionsNotice | null {
    return this._notice;
  }

  publish(regions: ReadonlyArray<UntranscribedRegion>, model: TranscribeModel): void {
    this._notice = { regions, model };
    this.dispatchEvent(new Event('change'));
  }

  clear(): void {
    if (this._notice === null) return;
    this._notice = null;
    this.dispatchEvent(new Event('change'));
  }
}
