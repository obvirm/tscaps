/**
 * Writes plain text to the system clipboard. Returns `false` when the
 * clipboard isn't available (very old browsers, insecure contexts) or
 * when the browser refuses the write. Never throws.
 */
export class TextClipboard {
  async copy(text: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
