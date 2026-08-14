import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';

interface ElementPositionRowProps {
  /** Narrower labels, for a popover rather than a sidebar. */
  compact?: boolean | undefined;
  /** Where the element was put, or `null` when it is still in the flow. */
  current: ElementPlacement | null;
  /** A complete position in screen terms — where the element sits while nobody has moved it. */
  baseline: ElementPlacement;
  /** `null` returns the element to the flow it was laid out in. */
  onCommit: (placement: ElementPlacement | null) => void;
}

/**
 * Two sliders placing the element in the frame.
 *
 * A placement is atomic in both directions: every commit writes all
 * four parts, or takes the whole thing back.
 *
 * All four, because a slider value is only a place while the anchor it
 * was read against holds still, and that anchor is free to move
 * afterwards — which covers the unmoved axis as much as the moved one,
 * and the anchors as much as the offsets. Or none, when the result
 * matches the inherited position: a placement that changes nothing
 * should not exist.
 *
 * `baseline` has to be a complete position in screen terms, so the
 * number a slider shows is the number a commit stores.
 */
export function ElementPositionRow({ current, baseline, compact, onCommit }: ElementPositionRowProps) {
  const position = current ?? baseline;
  const commitPosition = (next: ElementPlacement): void => {
    const inherited =
      next.verticalAlign === baseline.verticalAlign
      && next.verticalOffset === baseline.verticalOffset
      && next.horizontalAlign === baseline.horizontalAlign
      && next.horizontalOffset === baseline.horizontalOffset;
    onCommit(inherited ? null : next);
  };
  return (
    <>
      <Slider
        label="Vertical"
        value={position.verticalOffset}
        min={0}
        max={1}
        step={0.01}
        compact={compact === true}
        onChange={(v) => commitPosition({ ...position, verticalOffset: v })}
      />
      <Slider
        label="Horizontal"
        value={position.horizontalOffset}
        min={0}
        max={1}
        step={0.01}
        compact={compact === true}
        onChange={(v) => commitPosition({ ...position, horizontalOffset: v })}
      />
    </>
  );
}
