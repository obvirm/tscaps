import { describe, expect, it } from 'vitest';
import { TemplateClipLibrary } from '@presentation/editor/services/TemplateClipLibrary';

describe('TemplateClipLibrary', () => {
  const clips = new TemplateClipLibrary('/app/');

  it('names both assets after the template, under the app base', () => {
    expect(clips.clipFor('noor')).toMatchObject({
      clipUrl: '/app/templates/noor.mp4',
      posterUrl: '/app/templates/noor.jpg',
    });
  });

  it('resolves against the root when the app is served there', () => {
    expect(new TemplateClipLibrary('/').clipFor('noor').clipUrl).toBe('/templates/noor.mp4');
  });

  it('centres the crop for a template that did not ask for another one', () => {
    expect(clips.clipFor('noor').objectPosition).toBe('center 50%');
  });

  it('keeps the measured crop for the templates whose captions sit low', () => {
    expect(clips.clipFor('sara').objectPosition).toBe('center 100%');
    expect(clips.clipFor('selene').objectPosition).toBe('center 82%');
    expect(clips.clipFor('luna').objectPosition).toBe('center 75%');
  });
});
