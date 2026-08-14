import type { EditorStore } from '@core/editor/store/EditorStore';
import type { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import type { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import type { ElementControlRange } from '@presentation/editor/services/ElementControlRange';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import type { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type SegmentResizeBindInput,
  type SegmentResizeState,
  type SegmentResizeTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag a corner handle on the selected segment to scale
 * typography. Default rescales the font-size of the segment's own sheet
 * so every segment on it grows together — the natural model for
 * captions — and clears the dragged segment's per-segment font-size
 * override on first commit so it stops standing still while its
 * siblings scale around it. Holding Alt at pointerdown flips the
 * gesture: writes land on the override only.
 */
export class SegmentResizeGesture {
  /** Effective font-size captured at pointerdown so per-move commits
   *  scale the original value linearly with the cursor instead of
   *  compounding each tick. `null` between gestures. */
  private originalFontSize: number | null = null;
  /** Sheet the segment under the handle belongs to, captured at
   *  pointerdown. `null` between gestures. */
  private targetSheetId: string | null = null;
  /** True when Alt was held at pointerdown: writes land on the
   *  segment override instead of the sheet. */
  private scopedToSegment = false;
  /** True after the first non-scoped write has taken the dragged
   *  segment's own size back, so we don't issue a no-op clear every tick. */
  private clearedSegmentFontSize = false;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly segments: SegmentBindingRegistry,
    private readonly editorStore: EditorStore,
    private readonly updateTypography: UpdateTypographyAction,
    private readonly styledElementCatalog: StyledElementCatalog,
    private readonly setElementField: SetElementFieldAction,
    private readonly resizeGeometry: ResizeGeometryResolver,
    private readonly controlRange: ElementControlRange,
  ) {}

  bind(input: SegmentResizeBindInput): () => void {
    const target: SegmentResizeTarget = { kind: 'segment-resize', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: SegmentResizeTarget, clientX: number, clientY: number): SegmentResizeState {
    const original = this.originalFontSize ?? 0;
    const { dx, dy } = session.delta(clientX, clientY);
    const scale = this.resizeGeometry.scale(session.anchorRect, target.corner, dx, dy);
    const fontSize = this.controlRange.clamp(this.sizeControl(), original * scale);
    return { kind: 'segment-resize', segmentId: target.segmentId, fontSize, scopedToSegment: this.scopedToSegment };
  }

  applyMoveSideEffects(_session: DragSession, state: SegmentResizeState): void {
    this.writeFontSize(state.segmentId, state.fontSize);
  }

  commit(state: SegmentResizeState): void {
    // One last write so the release-cursor position matches the
    // committed value exactly; the action's coalescing key collapses
    // this with the per-tick updates into a single undo step.
    this.writeFontSize(state.segmentId, state.fontSize);
  }

  cleanupOnEnd(): void {
    // `scopedToSegment`, `clearedSegmentFontSize` and `targetSheetId` are
    // deliberately NOT reset here — they are latched for the whole
    // gesture and re-initialised at the next `tryStart`.
    this.originalFontSize = null;
  }

  private sizeControl(): AuthoredElementControl {
    return this.styledElementCatalog.requireControl('segment', ElementFieldId.FONT_SIZE);
  }

  private writeFontSize(segmentId: string, fontSize: number): void {
    if (this.scopedToSegment) {
      this.setElementField.execute(segmentId, 'segment', this.sizeControl(), fontSize);
      return;
    }
    if (this.targetSheetId === null) return;
    if (!this.clearedSegmentFontSize) {
      this.setElementField.clear(segmentId, 'segment', this.sizeControl());
      this.clearedSegmentFontSize = true;
    }
    this.updateTypography.execute(this.targetSheetId, { fontSize });
  }

  private tryStart(target: SegmentResizeTarget, event: PointerEvent): void {
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
    this.clearedSegmentFontSize = false;
    this.targetSheetId = sheet.id;
    this.originalFontSize = this.readBaselineFontSize(target.segmentId, sheet.typographyConfig.fontSize);
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

  /** The segment's own size when it has one (latched user choice),
   *  else the sheet's typography font-size (the effective baseline the
   *  user is scaling away from). Result is the size the segment
   *  currently renders at — the per-tick scale multiplies this. */
  private readBaselineFontSize(segmentId: string, sheetFontSize: number): number {
    const held = this.editorStore.snapshot().elementStyles.fieldNumber(segmentId, ElementFieldId.FONT_SIZE);
    return held ?? sheetFontSize;
  }
}
