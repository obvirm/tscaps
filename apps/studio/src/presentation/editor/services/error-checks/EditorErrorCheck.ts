import type { EditorState } from '@core/editor/domain/EditorState';
import type { AppError } from '@core/errors/domain/AppError';

/**
 * Detection result returned by an {@link EditorErrorCheck}. The
 * error is the notice to publish; the dedupe key is whatever value
 * identifies "this same situation" so the reporter can suppress a
 * repeat report while the situation persists and re-arm once it
 * changes. Two checks pointing at different aspects of the same
 * state pick their own keys (source file, cut set, sheet id, ...).
 */
export interface EditorErrorDetection {
  readonly error: AppError;
  readonly dedupeKey: unknown;
}

/**
 * A single anomaly detector that runs against the editor store.
 * Returns a detection when the state is currently in an anomalous
 * shape, or `null` when it is not. Implementations are pure with
 * respect to `state` — no store subscriptions, no side effects —
 * and let the shared reporter orchestrate lifecycle, dedup, and
 * publishing.
 */
export interface EditorErrorCheck {
  detect(state: EditorState): EditorErrorDetection | null;
}
