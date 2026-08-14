import { describe, expect, it } from 'vitest';
import { CssBlockSealer, CssMinifier } from '@tscaps/engine';
import { BalancedBlocksElementCssRule } from '@core/elements/services/css/BalancedBlocksElementCssRule';
import { ElementCssValidator } from '@core/elements/services/css/ElementCssValidator';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { PlayheadAnchoredAnimationElementCssRule } from '@core/elements/services/css/PlayheadAnchoredAnimationElementCssRule';

function validator(): ElementCssValidator {
  return new ElementCssValidator(new CssMinifier(), new ElementTimingVariableResolver(), [
    new BalancedBlocksElementCssRule(new CssBlockSealer()),
    new PlayheadAnchoredAnimationElementCssRule(),
  ]);
}

function messagesFor(css: string, kind: 'word' | 'segment' | 'decoration' = 'word'): string[] {
  return validator().validate(css, kind).map((problem) => problem.message);
}

describe('CSS that will do what it reads like', () => {
  it('passes plain declarations', () => {
    expect(messagesFor('color: gold;')).toEqual([]);
  });

  it('passes an animation anchored to the playhead', () => {
    expect(messagesFor(
      'animation: pop .4s var(--on-word-being-narrated-starts) ease both; @keyframes pop { from { scale: .4 } }',
    )).toEqual([]);
  });

  it('passes an anchor written as a longhand', () => {
    expect(messagesFor(
      'animation-name: pop; animation-duration: 1s; animation-delay: var(--on-segment-starts);',
      'segment',
    )).toEqual([]);
  });

  it('ignores an animation that is commented out', () => {
    expect(messagesFor('/* animation: pop 1s both; */ color: red;')).toEqual([]);
  });

  it('passes an element turned off, which has no frame to hold', () => {
    expect(messagesFor('animation: none;')).toEqual([]);
    expect(messagesFor('animation-name: none;')).toEqual([]);
  });

  it('still reports an unanchored animation sitting next to a switched-off one', () => {
    expect(messagesFor('animation: none; animation: pop 240ms both;')).toHaveLength(1);
  });
});

describe('an animation with no playhead-anchored delay', () => {
  it('is reported, because it renders as a still frame', () => {
    expect(messagesFor('animation: pop 240ms both; @keyframes pop { from { scale: .7 } }'))
      .toHaveLength(1);
  });

  it('names the variable that element kind should anchor to', () => {
    expect(messagesFor('animation: pop 240ms both;', 'word')[0])
      .toContain('--on-word-being-narrated-starts');
    expect(messagesFor('animation: pop 240ms both;', 'segment')[0])
      .toContain('--on-segment-starts');
  });

  it('anchors a decoration to the word it belongs to', () => {
    expect(messagesFor('animation: pop 240ms both;', 'decoration')[0])
      .toContain('--on-word-being-narrated-starts');
  });
});

describe('braces that do not pair up', () => {
  it('reports a closing brace with nothing to open it', () => {
    expect(messagesFor('color: red; } .loose { color: blue }')).toHaveLength(1);
  });

  it('reports a block left open', () => {
    expect(messagesFor('&:hover { color: blue;')).toHaveLength(1);
  });

  it('counts neither braces inside a string nor inside a comment', () => {
    expect(messagesFor('content: "}"; /* } */ color: red;')).toEqual([]);
  });
});
