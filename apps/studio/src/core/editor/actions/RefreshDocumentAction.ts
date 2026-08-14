import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { SheetTextScriptSynchronizer } from '@core/sheets/services/SheetTextScriptSynchronizer';

/**
 * Re-pipes every Section of the current Document according to its
 * `Section.kind` (which carries a Sheet id). Each section's segments are
 * merged and re-split per the sheet's current pipeline. No-op if
 * prerequisites aren't ready.
 *
 * Sheets' `textScript` is re-synced from the document first, because the
 * pipeline measures lines with each sheet's font stack and the stack's
 * leading face follows the script.
 */
export class RefreshDocumentAction {
  private _fontsRederivePending = false;

  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly textScriptSynchronizer: SheetTextScriptSynchronizer,
  ) {}

  execute(): void {
    const { document, sheets, video, frozenSegments, decorationOverrides } = this.store.snapshot();
    if (!document) return;
    if (sheets.length === 0) return;
    if (!video.layout) return;

    const syncedSheets = this.textScriptSynchronizer.sync(document, sheets);
    const next = this.deriver.derive(document, syncedSheets, {
      videoWidth: video.layout.width,
      videoHeight: video.layout.height,
      videoDurationSeconds: video.duration,
      frozenSegments,
      decorationOverrides,
    });
    this.store.patch({
      document: next,
      status: 'ready',
      ...(syncedSheets !== sheets ? { sheets: [...syncedSheets] } : {}),
    });

    // If fonts are still loading, the pixel-width splitter measured with the
    // fallback font. Re-derive once fonts are ready so line breaks reflect
    // actual font metrics.
    if (globalThis.document.fonts.status !== 'loaded' && !this._fontsRederivePending) {
      this._fontsRederivePending = true;
      globalThis.document.fonts.ready.then(() => {
        this._fontsRederivePending = false;
        this.execute();
      });
    }
  }
}
