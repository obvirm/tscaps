import type { EditorStore } from '@core/editor/store/EditorStore';
import type { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import type { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import type { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type SegmentRotateBindInput,
  type SegmentRotateState,
  type SegmentRotateTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag the rotation icon on the selected segment to rotate
 * around the centre of its wrapper bounding box. Default writes the
 * rotation of the segment's own sheet so every segment on it rotates
 * together — the natural model for captions — and clears the dragged
 * segment's per-segment rotation override on first commit so it stops
 * standing still while its siblings spin around. Holding Alt at
 * pointerdown flips the gesture: writes land on the override only.
 */
export class SegmentRotateGesture {
  /** Effective rotation captured at pointerdown, used as the base the
   *  per-tick delta is added to. `null` between gestures. */
  private originalRotationDeg: number | null = null;
  /** Sheet the segment under the handle belongs to, captured at
   *  pointerdown. `null` between gestures. */
  private targetSheetId: string | null = null;
  /** True when Alt was held at pointerdown: writes land on the
   *  segment override instead of the sheet. */
  private scopedToSegment = false;
  /** True after the first non-scoped write has taken the dragged
   *  segment's own angle back, so we don't issue a no-op clear every tick. */
  private clearedSegmentRotation = false;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly segments: SegmentBindingRegistry,
    private readonly editorStore: EditorStore,
    private readonly updateRotation: UpdateRotationAction,
    private readonly styledElementCatalog: StyledElementCatalog,
    private readonly setElementField: SetElementFieldAction,
    private readonly rotationGeometry: RotationGeometryResolver,
  ) {}

  bind(input: SegmentRotateBindInput): () => void {
    const target: SegmentRotateTarget = { kind: 'segment-rotate', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: SegmentRotateTarget, clientX: number, clientY: number): SegmentRotateState {
    const original = this.originalRotationDeg ?? 0;
    const pivotX = session.anchorRect.left + session.anchorRect.width / 2;
    const pivotY = session.anchorRect.top + session.anchorRect.height / 2;
    const delta = this.rotationGeometry.deltaDegrees(
      pivotX, pivotY, session.startClientX, session.startClientY, clientX, clientY,
    );
    const snap = this.rotationGeometry.snap(original + delta);
    return {
      kind: 'segment-rotate',
      segmentId: target.segmentId,
      rotationDeg: snap.value,
      snappedAngleDeg: snap.snappedTo,
      scopedToSegment: this.scopedToSegment,
    };
  }

  applyMoveSideEffects(_session: DragSession, state: SegmentRotateState): void {
    this.writeRotation(state.segmentId, state.rotationDeg);
  }

  commit(state: SegmentRotateState): void {
    this.writeRotation(state.segmentId, state.rotationDeg);
  }

  cleanupOnEnd(): void {
    // `scopedToSegment`, `clearedSegmentRotation` and `targetSheetId` are
    // deliberately NOT reset here — they are latched for the whole
    // gesture and re-initialised at the next `tryStart`.
    this.originalRotationDeg = null;
  }

  private rotationControl(): AuthoredElementControl {
    return this.styledElementCatalog.requireControl('segment', ElementFieldId.ROTATION);
  }

  private writeRotation(segmentId: string, rotationDeg: number): void {
    if (this.scopedToSegment) {
      this.setElementField.execute(segmentId, 'segment', this.rotationControl(), rotationDeg);
      return;
    }
    if (this.targetSheetId === null) return;
    if (!this.clearedSegmentRotation) {
      this.setElementField.clear(segmentId, 'segment', this.rotationControl());
      this.clearedSegmentRotation = true;
    }
    this.updateRotation.execute(this.targetSheetId, { angleDeg: rotationDeg });
  }

  private tryStart(target: SegmentRotateTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const segmentBinding = this.segments.get(target.segmentId);
    if (!segmentBinding) return;
    const sheet = this.editorStore.sheet(segmentBinding.sheetId);
    if (!sheet) return;
    event.stopPropagation();
    this.scopedToSegment = event.altKey;
    this.clearedSegmentRotation = false;
    this.targetSheetId = sheet.id;
    this.originalRotationDeg = this.readBaselineRotation(target.segmentId, sheet.rotationConfig.angleDeg);
    const session = new DragSession(
      target,
      segmentBinding.wrapper.getBoundingClientRect(),
      scaler.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      event.pointerId,
      DRAG_ACTIVATION_THRESHOLD_PX,
    );
    this.host.activateSession(session);
  }

  /** The segment's own angle when it has one (latched user choice),
   *  else the sheet's rotation (the effective baseline the user is
   *  rotating away from). Either way the result is the angle the
   *  segment currently appears at on screen — the per-tick delta is
   *  added on top. */
  private readBaselineRotation(segmentId: string, sheetRotationDeg: number): number {
    const held = this.editorStore.snapshot().elementStyles.fieldNumber(segmentId, ElementFieldId.ROTATION);
    return held ?? sheetRotationDeg;
  }
}
