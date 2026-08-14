import type { EditorStore } from '@core/editor/store/EditorStore';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import type { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type WordRotateBindInput,
  type WordRotateState,
  type WordRotateTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag the rotation icon on the selected word to rotate
 * that word's span around the centre of its glyph bounding box.
 * Commits the word's rotation on every pointermove; the field write
 * collapses the per-tick stream into a single undo entry. A word's
 * rotation is post-derivation so the line-splitter never reruns
 * mid-gesture.
 */
export class WordRotateGesture {
  /** Angle the word carried at pointerdown, used as the base the
   *  per-tick delta is added to. `null` between gestures. */
  private originalRotationDeg: number | null = null;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly editorStore: EditorStore,
    private readonly styledElementCatalog: StyledElementCatalog,
    private readonly setElementField: SetElementFieldAction,
    private readonly rotationGeometry: RotationGeometryResolver,
  ) {}

  bind(input: WordRotateBindInput): () => void {
    const target: WordRotateTarget = { kind: 'word-rotate', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: WordRotateTarget, clientX: number, clientY: number): WordRotateState {
    const original = this.originalRotationDeg ?? 0;
    const pivotX = session.anchorRect.left + session.anchorRect.width / 2;
    const pivotY = session.anchorRect.top + session.anchorRect.height / 2;
    const delta = this.rotationGeometry.deltaDegrees(
      pivotX, pivotY, session.startClientX, session.startClientY, clientX, clientY,
    );
    const snap = this.rotationGeometry.snap(original + delta);
    return {
      kind: 'word-rotate',
      wordId: target.wordId,
      rotationDeg: snap.value,
      snappedAngleDeg: snap.snappedTo,
    };
  }

  applyMoveSideEffects(_session: DragSession, state: WordRotateState): void {
    this.writeRotation(state.wordId, state.rotationDeg);
  }

  commit(state: WordRotateState): void {
    this.writeRotation(state.wordId, state.rotationDeg);
  }

  cleanupOnEnd(): void {
    this.originalRotationDeg = null;
  }

  private rotationControl(): AuthoredElementControl {
    return this.styledElementCatalog.requireControl('word', ElementFieldId.ROTATION);
  }

  private writeRotation(wordId: string, rotationDeg: number): void {
    this.setElementField.execute(wordId, 'word', this.rotationControl(), rotationDeg);
  }

  private tryStart(target: WordRotateTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const span = this.findWordSpan(scaler, target.wordId);
    if (!span) return;
    event.stopPropagation();
    this.originalRotationDeg = this.readBaselineRotation(target.wordId);
    const session = new DragSession(
      target,
      span.getBoundingClientRect(),
      scaler.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      event.pointerId,
      DRAG_ACTIVATION_THRESHOLD_PX,
    );
    this.host.activateSession(session);
  }

  private findWordSpan(scaler: HTMLElement, wordId: string): HTMLElement | null {
    return scaler.querySelector<HTMLElement>(`[data-tscaps-word-id="${CSS.escape(wordId)}"]`);
  }

  /** The word's own angle when it has one, else `0` — the segment /
   *  sheet rotation already cascades into the word's screen-position,
   *  so the per-tick delta only needs to add the user's incremental
   *  twist on top. */
  private readBaselineRotation(wordId: string): number {
    return this.editorStore.snapshot().elementStyles.fieldNumber(wordId, ElementFieldId.ROTATION) ?? 0;
  }
}
