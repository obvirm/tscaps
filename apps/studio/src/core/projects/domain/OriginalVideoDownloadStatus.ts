import type { AppError } from '@core/errors/domain/AppError';

/**
 * Discriminated snapshot of the in-flight (or completed) original-
 * video fetch for the active project.
 *
 * - `idle`: no project loaded, or the source bytes were never
 *   requested.
 * - `downloading`: fetch is in flight. `progress` is `null` when the
 *   transport could not advertise a content length; otherwise it
 *   carries the received fraction in `[0, 1]`.
 * - `ready`: bytes landed and the editor store's `video.file` reflects
 *   them.
 * - `failed`: fetch ended in error, and `error` carries it whole so
 *   whoever describes the failure can read the condition underneath
 *   instead of guessing at one.
 */
export type OriginalVideoDownloadStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'downloading'; readonly progress: number | null }
  | { readonly kind: 'ready' }
  | { readonly kind: 'failed'; readonly error: AppError };
