export interface LinkedSheetsPropagationEvent {
  readonly groupId: string;
  readonly propagatedCount: number;
}

export type LinkedSheetsPropagationListener = (event: LinkedSheetsPropagationEvent) => void;

/**
 * Broadcast channel for style propagations across linked sheets. Emits
 * when a shared style edit on one member of a link group reaches its
 * siblings. Subscribers decide how to surface it (throttling, first-run
 * hint, silent) — the notifier itself carries no policy.
 *
 * Listeners are invoked synchronously in registration order.
 */
export class LinkedSheetsPropagationNotifier {
  private readonly listeners = new Set<LinkedSheetsPropagationListener>();

  subscribe(listener: LinkedSheetsPropagationListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  notifyPropagation(event: LinkedSheetsPropagationEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
