import { CssVariable } from '@modules/document/CssVariable';
import { DataAttribute } from '@modules/document/DataAttribute';
import { Decoration } from '@modules/document/Decoration';
import type { Segment } from '@modules/document/Segment';
import type { TimeFragment } from '@modules/document/TimeFragment';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { AbstractAnim } from '@modules/rendering/subtitle/AbstractAnim';

const FINGERPRINT_BASE_S = 10000;

/**
 * One node of a probe chain, as the renderer would emit it: the tag it
 * carries, the classes on it, and the id a stylesheet can address it
 * by — `null` when the stylesheet addresses nothing here.
 */
interface ProbedElement {
  readonly tag: 'div' | 'span';
  readonly classes: ReadonlyArray<string>;
  readonly elementId: string | null;
}

/**
 * The windows a probed node's clock variables resolve against. `line`
 * and `word` are absent for a node that has none of its own, and every
 * variable naming one then falls back to the segment's.
 */
interface ProbedWindows {
  readonly segment: TimeFragment;
  readonly line: TimeFragment | null;
  readonly word: TimeFragment | null;
}

/**
 * Decides whether a render item should redraw every frame: builds
 * throw-away DOM chains matching what the renderer emits, reads back
 * resolved `animation-duration` / `animation-delay` from
 * `getComputedStyle`, and decodes each timing back to the CSS
 * variable that anchored its window. Caches per chain so the same one
 * is probed at most once. `clear` empties the cache.
 *
 * A chain carries the element ids the renderer stamps as well as the
 * classes, because a stylesheet can address one element rather than a
 * class of them. Built from classes alone, the chain resolves a
 * different animation than the node it stands for — none at all where
 * only the element carries one, and the wrong window where the
 * element's beats the template's. Either way the tile is reused across
 * a frame that moved, and the animation exports as a still image.
 *
 * Only ids the stylesheet actually addresses go on, so a caption
 * nobody has styled probes one chain per class combination as before.
 */
export class AnimationProbe {
  private readonly timingByKey = new Map<string, AbstractAnim[]>();

  isItemAnimating(style: PreparedStyle, seg: Segment, t: number): boolean {
    // Letter-level CSS typically combines time vars via calc(), which
    // destroys the fingerprint-based probe; treat the segment as
    // always animating in that mode and redraw every frame.
    if (style.rendering.splitWordsIntoLetters) return true;
    // Styles that bake the underlying video frame into their visuals
    // change every tick by definition — no two timestamps share state.
    if (style.rendering.videoFrame.required) return true;
    // Filter definitions whose materialized output can vary with
    // `currentTime` likewise force per-frame redraw; conservatively
    // treat any non-empty filter set as time-varying.
    if (!style.filters.definitions.isEmpty()) return true;

    const segment = this.probed(style, 'div', seg.getCssClasses(t), seg.id);
    const segmentWindows: ProbedWindows = { segment: seg.time, line: null, word: null };
    if (this.animates(style, [segment], t, segmentWindows)) return true;

    return [...seg.lines].some((line) => {
      const lineElement = this.probed(style, 'div', line.getCssClasses(t), line.id);
      const lineWindows: ProbedWindows = { ...segmentWindows, line: line.time };
      if (this.animates(style, [segment, lineElement], t, lineWindows)) return true;

      return [...line.words].some((word) => {
        const wordElement = this.probed(style, 'span', word.getCssClasses(t), word.id);
        const wordChain = [segment, lineElement, wordElement];
        if (this.animates(style, wordChain, t, { ...lineWindows, word: word.time })) return true;

        const decoration = word.decoration;
        if (!decoration) return false;
        const decorationElement = this.probed(style, 'span', [Decoration.CSS_CLASS], decoration.id);
        return this.animates(
          style,
          [...wordChain, decorationElement],
          t,
          { ...lineWindows, word: decoration.customTime ?? word.time },
        );
      });
    });
  }

  clear(): void {
    this.timingByKey.clear();
  }

  /** The element as the probe will build it, addressed only where the stylesheet says so. */
  private probed(
    style: PreparedStyle,
    tag: ProbedElement['tag'],
    classes: ReadonlyArray<string>,
    elementId: string,
  ): ProbedElement {
    return { tag, classes, elementId: style.addressableElementIds.has(elementId) ? elementId : null };
  }

  private animates(
    style: PreparedStyle,
    chain: ReadonlyArray<ProbedElement>,
    t: number,
    windows: ProbedWindows,
  ): boolean {
    return this.evalAnims(this.timingOf(style, chain), t, windows);
  }

  private timingOf(style: PreparedStyle, chain: ReadonlyArray<ProbedElement>): AbstractAnim[] {
    const key = `${style.kind}|${chain.map((element) => this.describe(element)).join('>')}`;
    let timing = this.timingByKey.get(key);
    if (!timing) {
      timing = this.probeChain(style, chain);
      this.timingByKey.set(key, timing);
    }
    return timing;
  }

  private describe(element: ProbedElement): string {
    return `${element.classes.join(' ')}#${element.elementId ?? ''}`;
  }

  /** Mounts the chain, reads what the leaf resolved to, and takes it back out. */
  private probeChain(style: PreparedStyle, chain: ReadonlyArray<ProbedElement>): AbstractAnim[] {
    const nodes = chain.map((element) => this.createNode(element));
    for (let index = 1; index < nodes.length; index++) nodes[index - 1]!.appendChild(nodes[index]!);
    const root = nodes[0]!;
    const leaf = nodes[nodes.length - 1]!;
    this.injectProbeMagic(leaf);
    style.probeContainer.appendChild(root);
    const timing = this.readAnimTimings(leaf);
    style.probeContainer.removeChild(root);
    return timing;
  }

  private createNode(element: ProbedElement): HTMLElement {
    const node = document.createElement(element.tag);
    node.className = element.classes.join(' ');
    if (element.elementId !== null) node.setAttribute(DataAttribute.ELEMENT_ID, element.elementId);
    return node;
  }

  // Each CssVariable gets a fingerprint-shaped duration value so the
  // computed `animation-delay` on a probed element identifies which
  // variable a rule consumed.
  private injectProbeMagic(el: HTMLElement): void {
    Object.values(CssVariable).forEach((cssVar, index) => {
      el.style.setProperty(cssVar, `${(index + 1) * FINGERPRINT_BASE_S}s`);
    });
  }

  private readAnimTimings(el: HTMLElement): AbstractAnim[] {
    const computed = window.getComputedStyle(el);
    const durations = this.parseDurationsS(computed.animationDuration);
    const delays = this.parseDurationsS(computed.animationDelay);
    const iterations = computed.animationIterationCount.split(',').map((s) => s.trim());

    if (durations.every((d) => d === 0)) return [];

    const anims: AbstractAnim[] = [];
    const variables = Object.values(CssVariable);

    for (let i = 0; i < durations.length; i++) {
      const d = durations[i] ?? 0;
      if (d === 0) continue;
      const dl = delays[i] ?? 0;
      const fingerprintIndex = (dl / FINGERPRINT_BASE_S) - 1;
      const cssVar = variables[fingerprintIndex];
      if (!cssVar) continue;
      const isInfinite = (iterations[i] ?? '1') === 'infinite';
      anims.push({ cssVar, durationS: isInfinite ? Infinity : d + 0.05 });
    }
    return anims;
  }

  private parseDurationsS(value: string): number[] {
    if (!value) return [0];
    return value.split(',').map((s) => {
      s = s.trim();
      if (s.endsWith('ms')) return parseFloat(s) / 1000;
      if (s.endsWith('s')) return parseFloat(s);
      return 0;
    });
  }

  private evalAnims(anims: AbstractAnim[], t: number, windows: ProbedWindows): boolean {
    const { segment } = windows;
    const line = windows.line ?? segment;
    const word = windows.word ?? segment;
    return anims.some((a) => {
      let startT: number;
      switch (a.cssVar) {
        case CssVariable.SEGMENT_STARTS: startT = segment.start; break;
        case CssVariable.SEGMENT_ENDS: startT = segment.end; break;

        case CssVariable.LINE_NOT_NARRATED_YET_STARTS: startT = segment.start; break;
        case CssVariable.LINE_NOT_NARRATED_YET_ENDS: startT = line.start; break;
        case CssVariable.LINE_BEING_NARRATED_STARTS: startT = line.start; break;
        case CssVariable.LINE_BEING_NARRATED_ENDS: startT = line.end; break;
        case CssVariable.LINE_ALREADY_NARRATED_STARTS: startT = line.end; break;
        case CssVariable.LINE_ALREADY_NARRATED_ENDS: startT = segment.end; break;

        case CssVariable.WORD_NOT_NARRATED_YET_STARTS: startT = segment.start; break;
        case CssVariable.WORD_NOT_NARRATED_YET_ENDS: startT = word.start; break;
        case CssVariable.WORD_BEING_NARRATED_STARTS: startT = word.start; break;
        case CssVariable.WORD_BEING_NARRATED_ENDS: startT = word.end; break;
        case CssVariable.WORD_ALREADY_NARRATED_STARTS: startT = word.end; break;
        case CssVariable.WORD_ALREADY_NARRATED_ENDS: startT = segment.end; break;

        default: return false;
      }
      return t >= startT && t < startT + a.durationS;
    });
  }
}
