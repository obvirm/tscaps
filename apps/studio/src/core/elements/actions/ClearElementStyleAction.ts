import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Takes back everything the editor holds about one element: what its
 * fields were left at, the entrance it was given, the CSS beside them,
 * and where it was dropped in the frame.
 *
 * Its own action rather than a write of empty CSS. Those are different
 * things: text arriving empty means the user emptied the editor and
 * says nothing about the fields, which keep their values so that
 * editing the text by hand does not quietly forget what was picked.
 * Wiping the element has to forget all of it, and doing it by writing
 * an empty document would leave every field recorded against a
 * declaration that is no longer there — each of them reporting, on the
 * next render, that the CSS had taken it over.
 */
export class ClearElementStyleAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(elementId: string): void {
    const snap = this.store.snapshot();
    const elementStyles = snap.elementStyles.without([elementId]);
    if (elementStyles === snap.elementStyles) return;

    this.store.commit(`elementStyle:${elementId}:cleared`);
    this.store.patch({ elementStyles });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }
}
