/**
 * How the pick mode interprets a user click on a scene:
 *
 * - `contiguous-from-start` — selects every scene from the first one up
 *   to (and including) the clicked one; a null click clears the set.
 * - `free` — toggles the clicked scene on its own.
 */
export type ScenePickConstraint = 'contiguous-from-start' | 'free';

/**
 * Snapshot of the pick mode at a moment in time. `initialSelection`
 * captures the selection at the moment pick mode was entered, so the
 * chrome can decide whether a "Clear" affordance is meaningful.
 */
export interface ScenePickSnapshot {
  readonly isActive: boolean;
  readonly constraint: ScenePickConstraint;
  readonly initialSelection: ReadonlySet<string>;
  readonly selection: ReadonlySet<string>;
  readonly hoveredBoundary: string | null;
}

/**
 * Parameters accepted when entering pick mode.
 */
export interface ScenePickEntry {
  readonly constraint: ScenePickConstraint;
  readonly initialSelection: ReadonlySet<string>;
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

const IDLE_SNAPSHOT: ScenePickSnapshot = {
  isActive: false,
  constraint: 'free',
  initialSelection: EMPTY_SELECTION,
  selection: EMPTY_SELECTION,
  hoveredBoundary: null,
};

/**
 * Holds the transient state of a scene pick session — whether it is
 * active, the constraint governing clicks, the live selection, and the
 * hovered boundary that drives preview highlighting. State is
 * observable through the `change` event and read via `snapshot()`.
 *
 * The controller is agnostic about *what* the selection represents (a
 * hook, a punchline, something else): the caller decides on entry by
 * picking the constraint and providing the initial selection, and on
 * exit by reading `snapshot().selection` and acting on it.
 */
export class ScenePickController extends EventTarget {
  private _snapshot: ScenePickSnapshot = IDLE_SNAPSHOT;

  snapshot(): ScenePickSnapshot {
    return this._snapshot;
  }

  enter(entry: ScenePickEntry): void {
    this._snapshot = {
      isActive: true,
      constraint: entry.constraint,
      initialSelection: entry.initialSelection,
      selection: entry.initialSelection,
      hoveredBoundary: null,
    };
    this._emit();
  }

  exit(): void {
    if (!this._snapshot.isActive) return;
    this._snapshot = IDLE_SNAPSHOT;
    this._emit();
  }

  /**
   * Applies a user click on `sceneId`, reshaping the selection per the
   * active constraint. `orderedSceneIds` is the scene list in the order
   * the user reads them (top to bottom in the transcript) and is only
   * inspected under `contiguous-from-start`; ignored under `free`.
   * Does nothing when pick mode is idle or when the click yields the
   * same selection already stored.
   */
  selectAt(sceneId: string, orderedSceneIds: ReadonlyArray<string>): void {
    if (!this._snapshot.isActive) return;
    const next = this._computeNextSelection(sceneId, orderedSceneIds);
    if (this._sameSet(this._snapshot.selection, next)) return;
    this._snapshot = { ...this._snapshot, selection: next };
    this._emit();
  }

  /**
   * Empties the live selection without exiting pick mode.
   */
  clear(): void {
    if (!this._snapshot.isActive) return;
    if (this._snapshot.selection.size === 0) return;
    this._snapshot = { ...this._snapshot, selection: EMPTY_SELECTION };
    this._emit();
  }

  /**
   * Stores the scene the user is currently hovering as the boundary of
   * a would-be selection, or clears it when `sceneId` is null. Views
   * read this to compute a preview highlight without committing.
   */
  hoverBoundary(sceneId: string | null): void {
    if (!this._snapshot.isActive) return;
    if (this._snapshot.hoveredBoundary === sceneId) return;
    this._snapshot = { ...this._snapshot, hoveredBoundary: sceneId };
    this._emit();
  }

  private _computeNextSelection(sceneId: string, orderedSceneIds: ReadonlyArray<string>): ReadonlySet<string> {
    if (this._snapshot.constraint === 'contiguous-from-start') {
      return this._sliceUpTo(sceneId, orderedSceneIds);
    }
    return this._toggle(sceneId, this._snapshot.selection);
  }

  private _sliceUpTo(sceneId: string, orderedSceneIds: ReadonlyArray<string>): ReadonlySet<string> {
    const idx = orderedSceneIds.indexOf(sceneId);
    if (idx < 0) return this._snapshot.selection;
    return new Set(orderedSceneIds.slice(0, idx + 1));
  }

  private _toggle(sceneId: string, current: ReadonlySet<string>): ReadonlySet<string> {
    const next = new Set(current);
    if (next.has(sceneId)) next.delete(sceneId);
    else next.add(sceneId);
    return next;
  }

  private _sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    if (a === b) return true;
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  }

  private _emit(): void {
    this.dispatchEvent(new Event('change'));
  }
}
