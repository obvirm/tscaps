import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import type { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import type { ElementControlRange } from '@presentation/editor/services/ElementControlRange';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type WordResizeBindInput,
  type WordResizeState,
  type WordResizeTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag a corner handle on the selected word to scale how big
 * that word is next to the words around it. A word's size is
 * post-derivation, so commits do not trigger a line-splitter re-run —
 * the handle can fire on every pointermove without debouncing. The
 * field write coalesces per-tick commits into one undo step.
 */
export class WordResizeGesture {
  /** How big the word was next to its neighbours at pointerdown, as a
   *  percentage, so per-move commits scale from the original value
   *  instead of compounding each tick. `null` between gestures. */
  private originalRatio: number | null = null;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly styledElementCatalog: StyledElementCatalog,
    private readonly setElementField: SetElementFieldAction,
    private readonly resizeGeometry: ResizeGeometryResolver,
    private readonly controlRange: ElementControlRange,
  ) {}

  bind(input: WordResizeBindInput): () => void {
    const target: WordResizeTarget = { kind: 'word-resize', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: WordResizeTarget, clientX: number, clientY: number): WordResizeState {
    const original = this.originalRatio ?? 0;
    const { dx, dy } = session.delta(clientX, clientY);
    const scale = this.resizeGeometry.scale(session.anchorRect, target.corner, dx, dy);
    const relativeSize = this.controlRange.clamp(this.sizeControl(), original * scale);
    return { kind: 'word-resize', wordId: target.wordId, relativeSize };
  }

  applyMoveSideEffects(_session: DragSession, state: WordResizeState): void {
    this.writeRelativeSize(state.wordId, state.relativeSize);
  }

  commit(state: WordResizeState): void {
    this.writeRelativeSize(state.wordId, state.relativeSize);
  }

  cleanupOnEnd(): void {
    this.originalRatio = null;
  }

  private sizeControl(): AuthoredElementControl {
    return this.styledElementCatalog.requireControl('word', ElementFieldId.RELATIVE_SIZE);
  }

  private writeRelativeSize(wordId: string, ratio: number): void {
    this.setElementField.execute(wordId, 'word', this.sizeControl(), ratio);
  }

  private tryStart(target: WordResizeTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const span = this.findWordSpan(scaler, target.wordId);
    if (!span) return;
    const originalRatio = this.readRenderedRatio(span);
    if (originalRatio === null) return;
    event.stopPropagation();
    this.originalRatio = originalRatio;
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

  /**
   * How big the word is drawn next to the text it sits in, as the
   * percentage the field stores. Measured against the word's own
   * parent because that is what a percentage font-size resolves
   * against, so whatever else grew the caption — a template shrinking
   * a long line, a resized scene — is already inside the number and
   * the ratio stays what the user set. Returns null while the parent
   * has no measurable size.
   */
  private readRenderedRatio(span: HTMLElement): number | null {
    const parent = span.parentElement;
    if (!parent) return null;
    const wordPx = parseFloat(getComputedStyle(span).fontSize);
    const parentPx = parseFloat(getComputedStyle(parent).fontSize);
    if (!Number.isFinite(wordPx) || !Number.isFinite(parentPx) || parentPx <= 0) return null;
    return (wordPx / parentPx) * 100;
  }
}
