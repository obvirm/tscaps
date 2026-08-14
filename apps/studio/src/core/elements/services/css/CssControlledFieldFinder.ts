import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * Finds the fields whose declaration has been taken over by hand.
 *
 * The question is asked the only way that has an answer: a field knows
 * exactly what it would write for the value it holds, so it asks
 * whether writing it again would change anything. If it would, the
 * declaration in the CSS is not the one the field put there, and the
 * field has stopped deciding that property.
 *
 * Nothing here interprets CSS. It never asks what a declaration means,
 * only whether it is character-for-character the one the record would
 * produce — which is why an expression no parser of ours could read is
 * reported correctly instead of being guessed at.
 *
 * A field with nothing recorded is never reported. It wrote no
 * declaration, so there is none for anyone to have taken.
 */
export class CssControlledFieldFinder {
  constructor(private readonly writer: ElementControlCssWriter) {}

  /** Ids of the controls the CSS now decides, out of the ones offered. */
  find(style: ElementStyle | null, controls: ReadonlyArray<AuthoredElementControl>): ReadonlySet<string> {
    const taken = new Set<string>();
    if (style === null) return taken;
    for (const control of controls) {
      const recorded = style.fields?.[control.id];
      if (recorded === undefined) continue;
      if (this.writer.write(style.css, control, recorded) !== style.css) taken.add(control.id);
    }
    return taken;
  }
}
