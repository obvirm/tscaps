/**
 * Boot-time preference for the preview surface variant:
 * - `canvas` / `native` pin the corresponding surface for the whole
 *   session — manual overrides for testing and for entry points that
 *   know their needs (e.g. an SRT-burn page that always wants the
 *   native surface).
 * - `auto` lets the surface follow what it plays: proxies on canvas,
 *   raw sources on native.
 */
export type PreviewSurfaceVariantPreference = 'auto' | 'canvas' | 'native';
