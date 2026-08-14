import { describe, expect, it } from 'vitest';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { AnimationValueComposer } from '@core/elements/services/css/AnimationValueComposer';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';

/**
 * What a property holds after one of the fields over it moves.
 *
 * A direction and a distance share one property, so each has to write
 * its own half and leave the other's alone. Moving the distance must
 * not straighten a caption that slides in from the left, and picking a
 * direction must not reset how far it travels.
 *
 * The round trip is the promise that matters: compose a field's value
 * onto a property, read it back with the parser, and get what was put
 * in. The two are one rule written twice, and they have to agree.
 */

const composer = new AnimationValueComposer();
const parser = new ElementControlValueParser();

const distance: AuthoredElementControl = {
  id: 'distance', label: 'Distance', property: '--entrance-slide', part: 'magnitude', type: 'number', unit: 'em',
};
const from: AuthoredElementControl = {
  id: 'from', label: 'From', property: '--entrance-slide', part: 'sign', type: 'select',
  options: [{ value: 'negative', label: 'Left' }, { value: 'positive', label: 'Right' }],
};
const overshoot: AuthoredElementControl = {
  id: 'overshoot', label: 'Overshoot', property: '--entrance-pop', part: 'whole', type: 'number',
};

function em(amount: number): AnimationValue {
  return { kind: 'number', amount, unit: 'em' };
}

describe('moving one half of a signed value', () => {
  it('changes the distance and keeps the direction', () => {
    expect(composer.compose(em(-1.5), distance, 0.4)).toEqual(em(-0.4));
  });

  it('changes the direction and keeps the distance', () => {
    expect(composer.compose(em(1.5), from, 'negative')).toEqual(em(-1.5));
    expect(composer.compose(em(-1.5), from, 'positive')).toEqual(em(1.5));
  });

  it('refuses to let the distance carry a direction of its own', () => {
    expect(composer.compose(em(1.5), distance, -0.4)).toEqual(em(0.4));
  });
});

describe('moving a value that is not split', () => {
  it('is the value, with the unit the field carries', () => {
    expect(composer.compose({ kind: 'number', amount: 0.1, unit: '' }, overshoot, 0.3))
      .toEqual({ kind: 'number', amount: 0.3, unit: '' });
  });

  it('keeps the unit the property already had when the field names none', () => {
    expect(composer.compose(em(0.1), overshoot, 0.3)).toEqual(em(0.3));
  });
});

describe('composing and reading back', () => {
  it('gives each field what it was moved to, without disturbing the other', () => {
    const moved = composer.compose(em(1.5), from, 'negative');
    const then = composer.compose(moved, distance, 0.8);

    expect(parser.parse(from, then)).toBe('negative');
    expect(parser.parse(distance, then)).toBe(0.8);
  });
});
