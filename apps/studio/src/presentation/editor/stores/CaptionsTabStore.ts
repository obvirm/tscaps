export type CaptionsTabId =
  | 'templates'
  | 'transcript'
  | 'typography'
  | 'style'
  | 'position'
  | 'motion'
  | 'effects'
  | 'layout'
  | 'code';

/**
 * Observable selection of the active tab inside the Captions sidebar
 * panel (Templates, Transcript, Typography, …). A `'change'` event
 * fires on every transition; identical writes are suppressed so
 * subscribers only see real edges.
 */
export class CaptionsTabStore extends EventTarget {
  private _activeTabId: CaptionsTabId = 'templates';

  get activeTabId(): CaptionsTabId {
    return this._activeTabId;
  }

  setActiveTab(id: CaptionsTabId): void {
    if (this._activeTabId === id) return;
    this._activeTabId = id;
    this.dispatchEvent(new Event('change'));
  }
}
