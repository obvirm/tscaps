import { describe, expect, it } from 'vitest';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementAnimationPreset } from '@core/elements/domain/ElementAnimationPreset';
import type { DeclaredAnimation } from '@core/templates/domain/definition/DeclaredAnimation';
import { TemplateAnimationAnswerResolver } from '@core/templates/services/animations/TemplateAnimationAnswerResolver';

/**
 * Which card the picker should already be showing as chosen.
 *
 * A sheet has nothing above it, so "as the template has it" is a fact
 * this panel can look up rather than a deferral. Naming the movement
 * beats naming where it came from, and where the template moves
 * nothing the honest card is "None" — the picker's word for exactly
 * that. What is left for the template's own card is movement the
 * picker cannot name, which is the only case a reader learns anything
 * from it.
 */

const preset = (id: string) => ({ id }) as unknown as ElementAnimationPreset;
const catalog = new ElementAnimationCatalog([preset('rise-in'), preset('fade-in')]);
const resolver = new TemplateAnimationAnswerResolver(catalog);

const on = (id: string, element: DeclaredAnimation['element']): DeclaredAnimation =>
  ({ id, element, values: {}, keyframes: [`tscaps-${id}`] });

function applying(...declared: DeclaredAnimation[]): DeclaredAnimation[] {
  return declared;
}

describe('what a template already does to a kind', () => {
  it('is the entrance it applied, when the picker has that card', () => {
    const applied = applying(on('rise-in', 'word'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'entrance', presetId: 'rise-in' });
  });

  it('is unnamed when it moves the kind with something the picker does not offer', () => {
    const applied = applying(on('settle-in', 'segment'));

    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'unnamed' });
  });

  it('is unnamed when it gave the kind two, since picking one would deny the other', () => {
    const applied = applying(on('rise-in', 'word'), on('fade-in', 'word'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'unnamed' });
  });

  it('is still when it moves that kind with nothing at all', () => {
    const applied = applying(on('rise-in', 'segment'));

    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'still' });
  });

  it('is still for a template that moves nothing anywhere', () => {
    expect(resolver.answerFor([], ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'still' });
    expect(resolver.answerFor([], ElementAnimationScope.WORDS)).toEqual({ kind: 'still' });
    expect(resolver.answerFor([], ElementAnimationScope.EMOJIS)).toEqual({ kind: 'still' });
  });

  it('reads each kind on its own when the template moves several', () => {
    const applied = applying(on('rise-in', 'segment'), on('fade-in', 'word'), on('hype-emoji-enter', 'decoration'));

    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'entrance', presetId: 'rise-in' });
    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'entrance', presetId: 'fade-in' });
    expect(resolver.answerFor(applied, ElementAnimationScope.EMOJIS)).toEqual({ kind: 'unnamed' });
  });

  // A caption whose letters type is a caption whose words hold still:
  // the panel answers for one kind, and nothing here moves the words.
  // Letters and lines have no panel of their own to say otherwise.
  it('is still for a kind whose only movement sits on a node no scope reaches', () => {
    const applied = applying(on('rise-in', 'line'), on('typewriter', 'letter'));

    expect(resolver.answerFor(applied, ElementAnimationScope.SEGMENTS)).toEqual({ kind: 'still' });
    expect(resolver.answerFor(applied, ElementAnimationScope.WORDS)).toEqual({ kind: 'still' });
  });
});
