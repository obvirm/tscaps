/**
 * Current selection inside the subtitle overlay.
 *
 * - `null` — nothing selected.
 * - `{ wordId: null, segmentId }` — segment-only selection.
 * - `{ wordId, segmentId }` — word within `segmentId`. `segmentId` is
 *   anchored to a specific active segment because multiple segments
 *   (across sheets) may be active simultaneously.
 */
export type OverlaySelection = { wordId: string | null; segmentId: string } | null;

/** Viewport-coordinate anchor for the right-click popover; `null` when closed. */
export type OverlayPopoverAnchor = { x: number; y: number } | null;

// The size, in screen pixels, a word has to reach along an axis before
// a click on it is comfortable. A word smaller than this — a comma, a
// one-letter word, anything in a preview scaled well down — grows a
// snap margin on that axis until it measures up; a word already this
// big grows none. Beyond the reach the click stays a segment click.
const COMFORTABLE_TARGET_PX = 24;

/**
 * Owns which caption element the user is working on, and the anchor of
 * the right-click popover over it. Lifecycle is `start()` / `stop()`:
 * start installs the window-level listeners (outside-pointerdown,
 * Escape); stop removes them. Observers subscribe via `subscribe` and
 * read state via `selectionSnapshot` / `paintedSelectionSnapshot` /
 * `popoverSnapshot`.
 *
 * The two states have deliberately different lifetimes. The popover is
 * ephemeral and closes the moment attention goes anywhere else. The
 * selection is what the user picked, and it survives everything the
 * pane it is tuned from does — every click into the sidebar keeps it,
 * because a panel editing the picked element is the point of the pick.
 * It clears on Escape, on being replaced, and on any click that lands
 * neither on a segment nor in the sidebar: the preview's own empty
 * space, the toolbar, the space around the video. Deselecting has to
 * be easy, and "click away from all of it" is the gesture every editor
 * shares.
 *
 * It survives the playhead moving off the element too. The selection
 * outliving what is on screen is the point: nothing about picking a word
 * says the user is done with it once the scene ends, and scrubbing back
 * finds it still picked. Surfaces that show the element itself want the
 * narrower `paintedSelectionSnapshot` — showing an element the preview
 * has stopped marking leaves the two disagreeing about what is selected.
 *
 * Selection lives in presentation, not in core, because it is not
 * application state: it is not persisted and has no domain meaning.
 * `WordDragGesture` consults it synchronously to gate accidental drags.
 */
export class OverlaySelectionController {
  private readonly subscribers = new Set<() => void>();
  private readonly directPickSubscribers = new Set<() => void>();
  private selection: OverlaySelection = null;
  private popover: OverlayPopoverAnchor = null;
  private paintedSegmentIds: ReadonlySet<string> = new Set();
  private onPointerDown: ((event: PointerEvent) => void) | null = null;
  private onKey: ((event: KeyboardEvent) => void) | null = null;

  start(): void {
    if (this.onPointerDown || this.onKey) return;
    // Bound to pointerdown rather than mousedown so a gesture starting on a
    // chrome element outside any `[data-tscaps-segment-id]` ancestor can keep
    // the popover alive by stopping propagation on its own pointerdown —
    // mousedown is a separate event stream and a `stopPropagation` on
    // pointerdown does not silence it.
    this.onPointerDown = (event) => {
      if (!this.selection && !this.popover) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-tscaps-segment-id]')) return;
      if (target.closest('[data-floating-layer]')) return;
      if (target.closest('[data-tscaps-sidebar]')) {
        this.closePopover();
        return;
      }
      this.clearSelection();
    };
    this.onKey = (event) => {
      if (event.key !== 'Escape') return;
      const target = event.target as HTMLElement | null;
      // Escape inside a field belongs to that field. A panel editing the
      // selected element is a text editor like any other, and losing the
      // selection out from under it would close the panel mid-sentence.
      if (target && this.isTextEntry(target)) return;
      this.clearSelection();
    };
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    if (this.onPointerDown) window.removeEventListener('pointerdown', this.onPointerDown);
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    this.onPointerDown = null;
    this.onKey = null;
    this.subscribers.clear();
    this.directPickSubscribers.clear();
    this.selection = null;
    this.popover = null;
    this.paintedSegmentIds = new Set();
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  /**
   * Notified when the user picks an element by pointing straight at it
   * and asking for nothing else.
   *
   * Narrower than a selection change on purpose, and the three it
   * leaves out are the three where acting on the pick would be acting
   * on something the user did not say: a right-click, which asked for
   * the element's popover; a pick made on the user's behalf; and a
   * drag, whose click never arrives.
   */
  subscribeToDirectPicks(callback: () => void): () => void {
    this.directPickSubscribers.add(callback);
    return () => { this.directPickSubscribers.delete(callback); };
  }

  selectionSnapshot(): OverlaySelection {
    return this.selection;
  }

  /**
   * The same pick, narrowed to when its segment is being painted.
   * `null` while the playhead is off it.
   *
   * Every surface that shows the element itself reads this one, so the
   * preview and the panels agree on whether there is anything to show
   * without each deciding for itself.
   */
  paintedSelectionSnapshot(): OverlaySelection {
    if (!this.selection) return null;
    return this.paintedSegmentIds.has(this.selection.segmentId) ? this.selection : null;
  }

  /** Registers which segments the preview is painting right now. */
  setPaintedSegmentIds(ids: ReadonlySet<string>): void {
    if (this.paintedSegmentIds === ids) return;
    this.paintedSegmentIds = ids;
    this.emit();
  }

  popoverSnapshot(): OverlayPopoverAnchor {
    return this.popover;
  }

  setSelection(next: OverlaySelection): void {
    if (this.selection === next) return;
    this.selection = next;
    this.popover = null;
    this.emit();
  }

  /**
   * Resolves a pointer event landing on `target` (at viewport
   * coordinates `clientX`/`clientY`) into a `{ segmentId, wordId }`
   * selection. Returns false if the point is not inside any segment —
   * caller decides what to do (currently: nothing, the global mousedown
   * listener handles outside-click dismissal). When `openPopover` is
   * true, also opens the popover anchored at the click point.
   *
   * `searchRoot` is the overlay scaler; word-snap searches the actual
   * `.segment` node under it, so a click landing on a scaler-level
   * segment hitzone (which also carries `data-tscaps-segment-id` but
   * no word descendants) can still snap to the nearest word.
   */
  selectAtPoint(target: HTMLElement, searchRoot: HTMLElement, clientX: number, clientY: number, openPopover: boolean): boolean {
    const hitEl = target.closest<HTMLElement>('[data-tscaps-segment-id]');
    if (!hitEl) return false;
    const segmentId = hitEl.getAttribute('data-tscaps-segment-id')!;
    const segmentEl = searchRoot.querySelector<HTMLElement>(
      `.segment[data-tscaps-segment-id="${CSS.escape(segmentId)}"]`,
    ) ?? hitEl;
    const wordId = this.resolveWordId(target, clientX, clientY, segmentEl);
    this.selection = { wordId, segmentId };
    this.popover = openPopover ? { x: clientX, y: clientY } : null;
    this.emit();
    if (!openPopover) this.emitDirectPick();
    return true;
  }

  /** Drops the selection, and the popover with it — a popover over nothing means nothing. */
  clearSelection(): void {
    if (!this.selection && !this.popover) return;
    this.selection = null;
    this.popover = null;
    this.emit();
  }

  /** Closes the popover and leaves the selection where it is. */
  closePopover(): void {
    if (!this.popover) return;
    this.popover = null;
    this.emit();
  }

  private isTextEntry(target: HTMLElement): boolean {
    return target.closest('input, textarea, select, [contenteditable="true"]') !== null;
  }

  private resolveWordId(target: HTMLElement, clientX: number, clientY: number, segmentEl: HTMLElement): string | null {
    const direct = target.closest<HTMLElement>('[data-tscaps-word-id]');
    if (direct) return direct.getAttribute('data-tscaps-word-id');
    return this.snapToNearestWordId(segmentEl, clientX, clientY);
  }

  private snapToNearestWordId(segmentEl: HTMLElement, clientX: number, clientY: number): string | null {
    let nearestId: string | null = null;
    let nearestDistance = Infinity;
    for (const el of segmentEl.querySelectorAll<HTMLElement>('[data-tscaps-word-id]')) {
      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      if (dx > this.reachAlong(rect.width) || dy > this.reachAlong(rect.height)) continue;
      const distance = Math.hypot(dx, dy);
      if (distance >= nearestDistance) continue;
      nearestDistance = distance;
      nearestId = el.getAttribute('data-tscaps-word-id');
    }
    return nearestId;
  }

  /**
   * How far past one edge of a word the snap reaches, along the axis
   * that edge is on.
   *
   * Only what is too small to hit gets any reach, and only enough to
   * bring it up to size. A word already comfortable along an axis gets
   * none, which is what keeps the space around the text belonging to
   * the segment: a word spans its whole line box vertically, so it was
   * never the hard direction, and reaching there took the segment's
   * own click surface away for no gain.
   */
  private reachAlong(extent: number): number {
    return Math.max(0, (COMFORTABLE_TARGET_PX - extent) / 2);
  }

  private emit(): void {
    for (const callback of this.subscribers) callback();
  }

  private emitDirectPick(): void {
    for (const callback of this.directPickSubscribers) callback();
  }
}
