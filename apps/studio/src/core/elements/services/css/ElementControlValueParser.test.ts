import { describe, expect, it } from 'vitest';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';

/**
 * Which half of a value each field takes.
 *
 * One property carries a direction and a distance between two fields,
 * and each has to take its own without taking the other's. Get it
 * wrong and a dial opens on a number nobody chose, which reads as the
 * caption lying about itself.
 */

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
const easing: AuthoredElementControl = {
  id: 'easing', label: 'Easing', property: '--entrance-easing', part: 'whole', type: 'select',
  options: [{ value: 'linear', label: 'Linear' }],
};

function em(amount: number): AnimationValue {
  return { kind: 'number', amount, unit: 'em' };
}

describe('the halves of a signed value', () => {
  it('give the distance without its direction', () => {
    expect(parser.parse(distance, em(-1.5))).toBe(1.5);
  });

  it('give the direction without its distance', () => {
    expect(parser.parse(from, em(-1.5))).toBe('negative');
    expect(parser.parse(from, em(1.5))).toBe('positive');
  });

  it('call a value resting at zero positive, since it travels nowhere either way', () => {
    expect(parser.parse(from, em(0))).toBe('positive');
  });
});

describe('a value that is not split', () => {
  it('is the amount, for a field that wanted a number', () => {
    expect(parser.parse(overshoot, { kind: 'number', amount: 0.1, unit: '' })).toBe(0.1);
  });

  it('is the text as it stands, for a field that did not', () => {
    expect(parser.parse(easing, { kind: 'text', text: 'linear' })).toBe('linear');
  });
});

describe('a value with no number under it', () => {
  it('is nothing a number field can hold', () => {
    expect(parser.parse(overshoot, { kind: 'text', text: 'var(--luca-anim-duration)' })).toBeNull();
  });

  it('is nothing either half of a split can hold', () => {
    expect(parser.parse(distance, { kind: 'text', text: 'var(--luca-slide)' })).toBeNull();
    expect(parser.parse(from, { kind: 'text', text: 'var(--luca-slide)' })).toBeNull();
  });
});
