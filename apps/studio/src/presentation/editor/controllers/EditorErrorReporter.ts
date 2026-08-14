import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { AppError } from '@core/errors/domain/AppError';
import type { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import type { EditorErrorCheck } from '@presentation/editor/services/error-checks/EditorErrorCheck';

/**
 * Runs a set of {@link EditorErrorCheck}s against the editor store
 * on every change, records a telemetry event on each fresh
 * detection, and publishes the resulting {@link AppError} onto the
 * shared notice channel so UI surfaces can react. Each check owns
 * its own dedupe key, so a persistent condition reports once and
 * a re-armed condition (new file, new cut set, ...) reports again.
 *
 * `start` begins listening to the store and runs the checks once;
 * `stop` releases it. Adding a new anomaly means writing one check
 * class and including it in the constructor's list — the reporter
 * needs no code changes and no per-anomaly wiring.
 */
export class EditorErrorReporter {

  private running = false;
  private readonly lastDedupeKeyByCheck = new Map<EditorErrorCheck, unknown>();

  constructor(
    private readonly store: EditorStore,
    private readonly checks: readonly EditorErrorCheck[],
    private readonly telemetry: Telemetry,
    private readonly noticeChannel: AppNoticeChannel,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.store.addEventListener('change', this.onStoreChange);
    this.evaluate();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.store.removeEventListener('change', this.onStoreChange);
  }

  private readonly onStoreChange = (): void => {
    this.evaluate();
  };

  private evaluate(): void {
    const state = this.store.snapshot();
    for (const check of this.checks) this.evaluateOne(check, state);
  }

  private evaluateOne(check: EditorErrorCheck, state: ReturnType<EditorStore['snapshot']>): void {
    const detection = check.detect(state);
    if (detection === null) {
      this.lastDedupeKeyByCheck.delete(check);
      return;
    }
    if (this.lastDedupeKeyByCheck.get(check) === detection.dedupeKey) return;
    this.lastDedupeKeyByCheck.set(check, detection.dedupeKey);
    this.publish(detection.error);
  }

  private publish(error: AppError): void {
    this.telemetry.capture('app_notice_published', { error_name: error.name });
    this.noticeChannel.publish(error);
  }
}
