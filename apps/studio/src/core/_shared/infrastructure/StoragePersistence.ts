/**
 * Asks the browser to stop treating this origin's storage as
 * disposable.
 *
 * Everything the app writes — projects, cached videos, preview
 * proxies, the on-device transcription model — lands in best-effort
 * storage by default, which browsers evict on their own under disk
 * pressure and without telling anyone. Persisted storage is exempt
 * from that: only the person using the browser can clear it. It does
 * not raise the quota, so a write refused for lack of room is refused
 * either way.
 *
 * The answer is not ours to control. Chromium decides from its own
 * engagement heuristics and never prompts, Firefox asks the user, and
 * a refusal is a normal outcome rather than a failure — which is why
 * asking is best-effort and the result is only worth reporting, never
 * acting on.
 *
 * Ask at a moment the person can connect to what they just did. A
 * request at page load turns into a permission prompt out of nowhere
 * on the browsers that show one.
 */
export class StoragePersistence {

  /**
   * Whether this origin's storage is exempt from automatic eviction,
   * requesting the exemption first if it does not already hold it.
   * Resolves `false` on a browser that does not offer the choice.
   */
  async ensure(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await this.isPersisted()) return true;
    try {
      return await navigator.storage.persist();
    } catch {
      // Some engines reject the request outright rather than
      // answering it. That is indistinguishable from a refusal.
      return false;
    }
  }

  /** Whether the exemption is already held. Never asks for it. */
  async isPersisted(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false;
    try {
      return await navigator.storage.persisted();
    } catch {
      // Reported as not persisted: an engine that will not answer is
      // not one that has promised to keep anything.
      return false;
    }
  }
}
