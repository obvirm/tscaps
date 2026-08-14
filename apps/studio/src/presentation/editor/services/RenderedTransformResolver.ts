/** The rotation and scale an element is actually painted with, its ancestors included. */
export interface RenderedTransform {
  readonly rotationDeg: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

interface Scale {
  readonly scaleX: number;
  readonly scaleY: number;
}

const IDENTITY: RenderedTransform = { rotationDeg: 0, scaleX: 1, scaleY: 1 };
const NO_SCALE: Scale = { scaleX: 1, scaleY: 1 };

/**
 * Reads the rotation and scale an element is painted with right now,
 * summing rotation and multiplying scale over every ancestor up to a
 * scope element (exclusive).
 *
 * Both halves come from the same walk because both reach an element the
 * same way: a word inside a rotated segment wrapper is rotated without
 * carrying a rotation, and a segment mid-entrance is scaled without its
 * layout box changing by a pixel. Anything framing what is on screen
 * needs both, and `getBoundingClientRect` gives neither back separately
 * — it reports the axis-aligned box a rotated element fits inside.
 *
 * Correct for transforms built from rotation and scale, which is what
 * this subtree carries. A skew would need a full decomposition to
 * recover the angle.
 */
export class RenderedTransformResolver {
  resolve(element: HTMLElement, scope: HTMLElement): RenderedTransform {
    let rotationDeg = 0;
    let scaleX = 1;
    let scaleY = 1;
    for (let current: HTMLElement | null = element; current && current !== scope; current = current.parentElement) {
      const styles = window.getComputedStyle(current);
      rotationDeg += this.standaloneRotationDegrees(styles);
      const standaloneScale = this.standaloneScale(styles);
      const matrix = this.matrixTransform(styles);
      rotationDeg += matrix.rotationDeg;
      scaleX *= standaloneScale.scaleX * matrix.scaleX;
      scaleY *= standaloneScale.scaleY * matrix.scaleY;
    }
    return { rotationDeg, scaleX, scaleY };
  }

  private standaloneRotationDegrees(styles: CSSStyleDeclaration): number {
    const rotate = styles.rotate;
    if (!rotate || rotate === 'none') return 0;
    const match = /^(-?\d*\.?\d+)deg$/.exec(rotate.trim());
    return match?.[1] !== undefined ? Number(match[1]) : 0;
  }

  private standaloneScale(styles: CSSStyleDeclaration): Scale {
    const scale = styles.scale;
    if (!scale || scale === 'none') return NO_SCALE;
    const parts = scale.trim().split(/\s+/).map(Number);
    const x = parts[0];
    if (x === undefined || Number.isNaN(x)) return NO_SCALE;
    const y = parts[1];
    return { scaleX: x, scaleY: y === undefined || Number.isNaN(y) ? x : y };
  }

  // `atan2(b, a)` recovers the angle and `hypot` the axis lengths of the
  // 2D matrix every computed `transform` resolves to, whatever shorthand
  // wrote it.
  private matrixTransform(styles: CSSStyleDeclaration): RenderedTransform {
    const value = styles.transform;
    if (!value || value === 'none') return IDENTITY;
    const body = /^matrix\(([^)]+)\)$/.exec(value.trim())?.[1];
    if (body === undefined) return IDENTITY;
    const [a, b, c, d] = body.split(',').map((part) => parseFloat(part.trim()));
    if (a === undefined || b === undefined || c === undefined || d === undefined) return IDENTITY;
    if ([a, b, c, d].some(Number.isNaN)) return IDENTITY;
    return {
      rotationDeg: Math.atan2(b, a) * (180 / Math.PI),
      scaleX: Math.hypot(a, b),
      scaleY: Math.hypot(c, d),
    };
  }
}
