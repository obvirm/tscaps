import { describe, expect, it } from 'vitest';
import { AnimationFieldCatalog } from '@core/elements/domain/AnimationFieldCatalog';
import type { AnimationValue } from '@core/elements/domain/AnimationValue';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import { TemplateAnimationFieldResolver } from '@core/templates/services/animations/TemplateAnimationFieldResolver';

/**
 * Which dials a template offers over the movement it already has.
 *
 * Two rules, and everything here follows from them. A dial belongs to
 * the kind of element the animation was applied to, because that is
 * where a tuned value has to be declared to be read at all. And an
 * element ends up with one value per property, so a dial exists exactly
 * where the template gave that property one answer — two answers, or an
 * answer with no number under it, is no dial, and the animation goes on
 * running either way.
 */

const RISE_DISTANCE: AuthoredElementControl = {
  id: 'distance', label: 'Distance', property: '--entrance-rise', part: 'magnitude', type: 'number', unit: 'em',
};
const RISE_FROM: AuthoredElementControl = {
  id: 'from', label: 'From', property: '--entrance-rise', part: 'sign', type: 'select',
  options: [{ value: 'negative', label: 'Above' }, { value: 'positive', label: 'Below' }],
};
const DURATION: AuthoredElementControl = {
  id: 'duration', label: 'Duration', property: '--entrance-duration', part: 'whole', type: 'number', unit: 's',
};
const SLIDE_DISTANCE: AuthoredElementControl = {
  id: 'distance', label: 'Distance', property: '--entrance-slide', part: 'magnitude', type: 'number', unit: 'em',
};

const catalog = new AnimationFieldCatalog({
  'rise-in': [RISE_FROM, RISE_DISTANCE, DURATION],
  'slide-in': [SLIDE_DISTANCE, DURATION],
  'settle-in': [],
});

const resolver = new TemplateAnimationFieldResolver(catalog, new ElementControlValueParser());

function number(amount: number, unit: string): AnimationValue {
  return { kind: 'number', amount, unit };
}

/** The animations a template applies, in the order its stylesheet declared them. */
function applying(...declared: DeclaredAnimation[]): DeclaredAnimation[] {
  return declared;
}

describe('the dials a template offers', () => {
  it('are the fields of the animation it applies to that kind', () => {
    const applied = applying({
      id: 'rise-in',
      element: 'segment',
      keyframes: [],
      values: { '--entrance-rise': number(0.2, 'em'), '--entrance-duration': number(0.32, 's') },
    });

    const fields = resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS);

    expect(fields.map((field) => [field.control.label, field.control.defaultValue])).toEqual([
      ['From', 'positive'],
      ['Distance', 0.2],
      ['Duration', 0.32],
    ]);
  });

  it('are nothing for a kind the template does not move', () => {
    const applied = applying({ id: 'rise-in', element: 'segment', keyframes: [], values: { '--entrance-rise': number(0.2, 'em') } });

    expect(resolver.fieldsFor(applied, ElementAnimationScope.WORDS)).toEqual([]);
  });

  it('follow the element each animation was applied to, not the caption it sits in', () => {
    const applied = applying(
      { id: 'rise-in', element: 'segment', keyframes: [], values: { '--entrance-rise': number(0.2, 'em') } },
      { id: 'slide-in', element: 'word', keyframes: [], values: { '--entrance-slide': number(1.5, 'em') } },
    );

    const scenes = resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS);
    const words = resolver.fieldsFor(applied, ElementAnimationScope.WORDS);

    expect(scenes.map((field) => field.control.property)).toEqual(['--entrance-rise', '--entrance-rise']);
    expect(words.map((field) => field.control.property)).toEqual(['--entrance-slide']);
  });

  it('are nothing for an animation applied to a node no scope reaches', () => {
    const applied = applying({ id: 'rise-in', element: 'line', keyframes: [], values: { '--entrance-rise': number(0.2, 'em') } });

    expect(resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS)).toEqual([]);
    expect(resolver.fieldsFor(applied, ElementAnimationScope.WORDS)).toEqual([]);
  });
});

describe('a property two animations both answer', () => {
  const applied = applying(
    {
      id: 'rise-in',
      element: 'segment',
      keyframes: [],
      values: { '--entrance-rise': number(0.2, 'em'), '--entrance-duration': number(0.3, 's') },
    },
    {
      id: 'slide-in',
      element: 'segment',
      keyframes: [],
      values: { '--entrance-slide': number(1.5, 'em'), '--entrance-duration': number(0.9, 's') },
    },
  );

  it('is one dial, since the element ends up with one value for it', () => {
    const fields = resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS);

    expect(fields.filter((field) => field.control.property === '--entrance-duration')).toHaveLength(1);
  });

  it('keeps every other dial both animations brought', () => {
    const fields = resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS);

    expect(fields.map((field) => field.control.property)).toEqual([
      '--entrance-rise', '--entrance-rise', '--entrance-duration', '--entrance-slide',
    ]);
  });
});

describe('a field with nothing to start on', () => {
  it('is left out when the template answered that property two ways', () => {
    const applied = applying({
      id: 'rise-in',
      element: 'segment',
      keyframes: [],
      values: { '--entrance-duration': number(0.32, 's') },
    });

    const fields = resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS);

    expect(fields.map((field) => field.control.property)).toEqual(['--entrance-duration']);
  });

  it('is left out when the value has no number under it', () => {
    const applied = applying({
      id: 'rise-in',
      element: 'segment',
      keyframes: [],
      values: { '--entrance-rise': number(0.2, 'em'), '--entrance-duration': { kind: 'text', text: 'var(--own)' } },
    });

    const fields = resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS);

    expect(fields.map((field) => field.control.property)).toEqual(['--entrance-rise', '--entrance-rise']);
  });

  it('is nothing at all for an animation that declares no fields', () => {
    const applied = applying({ id: 'settle-in', element: 'segment', keyframes: [], values: { '--entrance-rise': number(0.06, 'em') } });

    expect(resolver.fieldsFor(applied, ElementAnimationScope.SEGMENTS)).toEqual([]);
  });
});

describe('the glyphs beside a word', () => {
  it('are not answered by the animation the words run', () => {
    const applied = applying({ id: 'rise-in', element: 'word', keyframes: [], values: { '--entrance-rise': number(0.2, 'em') } });

    expect(resolver.fieldsFor(applied, ElementAnimationScope.EMOJIS)).toEqual([]);
  });

  it('are answered by an animation the template applied to them', () => {
    const applied = applying({ id: 'rise-in', element: 'decoration', keyframes: [], values: { '--entrance-rise': number(0.2, 'em') } });

    const fields = resolver.fieldsFor(applied, ElementAnimationScope.EMOJIS);

    expect(fields.map((field) => field.control.property)).toEqual(['--entrance-rise', '--entrance-rise']);
  });
});
