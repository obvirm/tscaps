import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ChromeGeometry, OverlayChromeSource } from '@presentation/editor/services/OverlayChromeSource';

/**
 * Keeps every piece of overlay chrome over the element it frames while
 * the playhead moves.
 *
 * A caption's animations are paused and the frame is chosen by a
 * variable written on each `timechange`, so an element mid-entrance
 * moves, turns and scales without React rendering anything and without
 * its layout box changing — nothing a `ResizeObserver` or a rendered
 * prop can report. Measuring is the only way to find out, and the
 * playhead is the only signal that it is worth doing.
 *
 * Two costs are answered here. A frame's work is measured for every
 * piece before it is written for any, so the browser lays the page out
 * once instead of once per piece; and a piece whose geometry has not
 * changed writes nothing, which is every piece of every frame of a
 * template that does not animate. Ticks are coalesced onto one animation
 * frame, so a burst of `timechange` events costs one pass.
 *
 * Lifecycle is `start()` / `stop()`. Pieces can register and unregister
 * at any time, including between those calls.
 */
export class OverlayChromeRepositioner {
  private readonly sources = new Set<OverlayChromeSource>();
  private readonly lastApplied = new Map<OverlayChromeSource, ChromeGeometry>();
  private running = false;
  private scheduledFrame: number | null = null;

  constructor(private readonly store: EditorStore) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.store.addEventListener('timechange', this.onTimeChange);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.store.removeEventListener('timechange', this.onTimeChange);
    this.cancelScheduledFrame();
  }

  /** Adds a piece and returns the disposer that drops it. */
  register(source: OverlayChromeSource): () => void {
    this.sources.add(source);
    return () => {
      this.sources.delete(source);
      this.lastApplied.delete(source);
    };
  }

  /**
   * Re-measures and re-writes one piece straight away, whether or not
   * anything about it changed. For the moments a caller already knows
   * the chrome is stale — a fresh selection, a drag tick, a resize —
   * where the write has to land in the frame being committed.
   */
  repositionNow(source: OverlayChromeSource): void {
    const box = source.box();
    const scaler = source.scaler();
    if (!box || !scaler) return;
    const target = source.target();
    if (!target) {
      this.hide(box, source);
      return;
    }
    const geometry = source.measure(target, scaler);
    box.style.visibility = 'visible';
    source.apply(box, geometry);
    this.lastApplied.set(source, geometry);
  }

  private readonly onTimeChange = (): void => {
    if (this.scheduledFrame !== null || this.sources.size === 0) return;
    this.scheduledFrame = requestAnimationFrame(() => {
      this.scheduledFrame = null;
      this.repositionAll();
    });
  };

  /**
   * Runs after the tick's own DOM writes, so what it measures is the
   * frame the caption is actually painting.
   */
  private repositionAll(): void {
    const measured = new Map<OverlayChromeSource, ChromeGeometry | null>();
    for (const source of this.sources) measured.set(source, this.measureOne(source));
    for (const [source, geometry] of measured) this.applyOne(source, geometry);
  }

  private measureOne(source: OverlayChromeSource): ChromeGeometry | null {
    const scaler = source.scaler();
    if (!source.box() || !scaler) return null;
    const target = source.target();
    return target ? source.measure(target, scaler) : null;
  }

  private applyOne(source: OverlayChromeSource, geometry: ChromeGeometry | null): void {
    const box = source.box();
    if (!box) return;
    if (!geometry) {
      this.hide(box, source);
      return;
    }
    if (this.sameAsApplied(source, geometry)) return;
    box.style.visibility = 'visible';
    source.apply(box, geometry);
    this.lastApplied.set(source, geometry);
  }

  private sameAsApplied(source: OverlayChromeSource, geometry: ChromeGeometry): boolean {
    const applied = this.lastApplied.get(source);
    if (!applied) return false;
    return applied.left === geometry.left
      && applied.top === geometry.top
      && applied.width === geometry.width
      && applied.height === geometry.height
      && applied.transform === geometry.transform;
  }

  private hide(box: HTMLElement, source: OverlayChromeSource): void {
    box.style.visibility = 'hidden';
    this.lastApplied.delete(source);
  }

  private cancelScheduledFrame(): void {
    if (this.scheduledFrame === null) return;
    cancelAnimationFrame(this.scheduledFrame);
    this.scheduledFrame = null;
  }
}
