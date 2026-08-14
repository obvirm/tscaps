export type EditorModeId = 'captions' | 'timeline';

/**
 * What the editor's right pane is showing: which mode is open, and
 * whether the element inspector stands in front of it.
 *
 * The inspector is not a mode. A mode is always there to be opened,
 * while the inspector answers for whatever is picked in the preview —
 * nothing, most of the time. It opens on request and stands over the
 * mode until it is closed, so it costs nothing while there is nothing
 * to say.
 *
 * A `'change'` event fires on every transition.
 */
export class EditorWorkspaceStore extends EventTarget {
  private _activeModeId: EditorModeId = 'captions';
  private _isInspectorOpen = false;

  get activeModeId(): EditorModeId {
    return this._activeModeId;
  }

  /**
   * Whether the inspector was asked for. It stays asked-for across
   * picks: someone who opened it once is working element by element,
   * and making them reopen it on every pick would be the whole cost of
   * the surface, paid again per element.
   */
  get isInspectorOpen(): boolean {
    return this._isInspectorOpen;
  }

  setActiveMode(id: EditorModeId): void {
    if (this._activeModeId === id) return;
    this._activeModeId = id;
    this.dispatchEvent(new Event('change'));
  }

  setInspectorOpen(open: boolean): void {
    if (this._isInspectorOpen === open) return;
    this._isInspectorOpen = open;
    this.dispatchEvent(new Event('change'));
  }
}
