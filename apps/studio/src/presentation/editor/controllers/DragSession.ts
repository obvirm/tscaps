import type { AnyDragTarget } from '@presentation/editor/controllers/OverlayManipulationTypes';
import {
  PointerDragSession,
  type PointerDelta,
  type PointerDragHandlers,
} from '@presentation/gestures/controllers/PointerDragSession';

/**
 * State of a single in-flight overlay drag. Snapshots the anchor rect
 * (the element whose centroid follows the cursor) and the scaler rect
 * at pointerdown so later geometry derives from a fixed frame even if
 * the DOM shifts mid-drag.
 *
 * Target shape is a discriminated union — segment vs word — so the
 * controller can branch on `target.kind` to decide what to paint and
 * what to commit, while the pointer bookkeeping underneath stays
 * kind-agnostic.
 */
export class DragSession {
  private readonly pointer: PointerDragSession;

  constructor(
    readonly target: AnyDragTarget,
    readonly anchorRect: DOMRect,
    readonly scalerRect: DOMRect,
    readonly startClientX: number,
    readonly startClientY: number,
    readonly pointerId: number,
    activationThresholdPx: number,
  ) {
    this.pointer = new PointerDragSession(pointerId, startClientX, startClientY, activationThresholdPx);
  }

  attach(handlers: PointerDragHandlers): void {
    this.pointer.attach(handlers);
  }

  dispose(): void {
    this.pointer.dispose();
  }

  delta(clientX: number, clientY: number): PointerDelta {
    return this.pointer.delta(clientX, clientY);
  }

  evaluateActivation(clientX: number, clientY: number): boolean {
    return this.pointer.evaluateActivation(clientX, clientY);
  }

  get activated(): boolean {
    return this.pointer.activated;
  }
}
