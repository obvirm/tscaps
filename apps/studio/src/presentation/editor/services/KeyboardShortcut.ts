/**
 * Declarative description of a keyboard shortcut. The `cmdOrCtrl`
 * modifier names the cross-platform "primary" modifier — it matches
 * either Cmd (Mac) or Ctrl (everywhere else), so consumers never
 * need to branch on platform when wiring listeners.
 *
 * Instances are immutable and safe to share across the app — the
 * usual pattern is one exported constant per shortcut.
 */
export class KeyboardShortcut {

  constructor(
    readonly key: string,
    readonly cmdOrCtrl: boolean = false,
    readonly shift: boolean = false,
    readonly alt: boolean = false,
  ) {}

  matches(event: KeyboardEvent): boolean {
    // A window-level listener sees every keydown on the page, including
    // ones the browser synthesizes with no `key` at all — the type says
    // string, the runtime does not. Nothing names a key it does not have.
    if (typeof event.key !== 'string') return false;
    if (event.key.toLowerCase() !== this.key.toLowerCase()) return false;
    const primaryDown = event.ctrlKey || event.metaKey;
    if (this.cmdOrCtrl !== primaryDown) return false;
    if (this.shift !== event.shiftKey) return false;
    if (this.alt !== event.altKey) return false;
    return true;
  }
}
