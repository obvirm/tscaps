export interface PointerDragHandlers {
  onMove(event: PointerEvent): void;
  onUp(event: PointerEvent): void;
  onCancel(event: PointerEvent): void;
}

export interface PointerDelta {
  readonly dx: number;
  readonly dy: number;
}

const DEFAULT_ACTIVATION_THRESHOLD_PX = 3;

/**
 * One in-flight pointer drag.
 *
 * Owns the move/up/cancel listeners on `window` so events keep flowing
 * even when the element the press started on unmounts mid-gesture —
 * a virtualized list recycles rows out from under the pointer, and an
 * overlay word lifts into a different element the moment it starts
 * moving. A listener bound to the original element would die with it.
 * Each handler call is filtered by `pointerId`, so an unrelated touch
 * on a multi-pointer device cannot drive this session.
 *
 * The session is "activated" once the pointer has crossed the
 * activation threshold; a release before that point is a plain click
 * and the caller commits nothing. The threshold is in pixels, so the
 * same hand movement reads the same way regardless of what the
 * surface maps its coordinates onto.
 */
export class PointerDragSession {
  private hasActivated = false;
  private installedHandlers: PointerDragHandlers | null = null;

  constructor(
    readonly pointerId: number,
    readonly startClientX: number,
    readonly startClientY: number,
    private readonly activationThresholdPx: number = DEFAULT_ACTIVATION_THRESHOLD_PX,
  ) {}

  attach(handlers: PointerDragHandlers): void {
    if (this.installedHandlers) return;
    const filtered: PointerDragHandlers = {
      onMove: (event) => { if (event.pointerId === this.pointerId) handlers.onMove(event); },
      onUp: (event) => { if (event.pointerId === this.pointerId) handlers.onUp(event); },
      onCancel: (event) => { if (event.pointerId === this.pointerId) handlers.onCancel(event); },
    };
    this.installedHandlers = filtered;
    window.addEventListener('pointermove', filtered.onMove);
    window.addEventListener('pointerup', filtered.onUp);
    window.addEventListener('pointercancel', filtered.onCancel);
  }

  dispose(): void {
    const handlers = this.installedHandlers;
    if (!handlers) return;
    window.removeEventListener('pointermove', handlers.onMove);
    window.removeEventListener('pointerup', handlers.onUp);
    window.removeEventListener('pointercancel', handlers.onCancel);
    this.installedHandlers = null;
  }

  delta(clientX: number, clientY: number): PointerDelta {
    return { dx: clientX - this.startClientX, dy: clientY - this.startClientY };
  }

  /** Latches `activated` once the pointer has moved past the threshold. Returns the latched value. */
  evaluateActivation(clientX: number, clientY: number): boolean {
    if (this.hasActivated) return true;
    const { dx, dy } = this.delta(clientX, clientY);
    if (Math.hypot(dx, dy) >= this.activationThresholdPx) this.hasActivated = true;
    return this.hasActivated;
  }

  /**
   * Latches `activated` without waiting for the threshold, for gestures
   * that start from an affordance the user already aimed at and that
   * therefore have nothing to disambiguate from a click.
   */
  activate(): void {
    this.hasActivated = true;
  }

  get activated(): boolean {
    return this.hasActivated;
  }
}
