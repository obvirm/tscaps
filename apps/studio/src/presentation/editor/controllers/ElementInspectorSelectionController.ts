import type { EditorWorkspaceStore } from '@presentation/editor/stores/EditorWorkspaceStore';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';

/**
 * Ties the element inspector's lifetime to the pick it answers for:
 * pointing at an element opens it, letting go of the pick closes it.
 * Lifecycle is `start()` / `stop()`.
 *
 * Only a **direct** pick opens it. A drag never does — its click is
 * suppressed — so repositioning or resizing a caption leaves whoever is
 * browsing templates where they were, and a right-click opens the
 * element's popover instead, which is the surface that gesture asked
 * for.
 *
 * Closing watches the **painted** pick, so the panel goes the moment
 * the element does — playing past the scene is the same door as the
 * back button. The pick outlives it, so scrubbing back finds the
 * element still marked and the panel one press away. Nothing is lost
 * to a replay either: a replay stops a frame short of its own scene.
 */
export class ElementInspectorSelectionController {
  private unsubscribeFromChanges: (() => void) | null = null;
  private unsubscribeFromDirectPicks: (() => void) | null = null;

  constructor(
    private readonly selectionController: OverlaySelectionController,
    private readonly workspaceStore: EditorWorkspaceStore,
  ) {}

  start(): void {
    if (this.unsubscribeFromChanges) return;
    this.unsubscribeFromChanges = this.selectionController.subscribe(() => this.closeWhenNothingIsPicked());
    this.unsubscribeFromDirectPicks = this.selectionController.subscribeToDirectPicks(
      () => this.workspaceStore.setInspectorOpen(true),
    );
  }

  stop(): void {
    this.unsubscribeFromChanges?.();
    this.unsubscribeFromDirectPicks?.();
    this.unsubscribeFromChanges = null;
    this.unsubscribeFromDirectPicks = null;
  }

  private closeWhenNothingIsPicked(): void {
    if (this.selectionController.paintedSelectionSnapshot() === null) {
      this.workspaceStore.setInspectorOpen(false);
    }
  }
}
