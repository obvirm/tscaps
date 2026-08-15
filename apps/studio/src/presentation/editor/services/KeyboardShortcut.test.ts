import { describe, expect, it } from 'vitest';
import { KeyboardShortcut } from '@presentation/editor/services/KeyboardShortcut';

/**
 * A keydown as a listener receives it. Untyped on purpose: the point of
 * one of these tests is a `key` the type forbids and the browser sends.
 */
function keydown(init: Record<string, unknown>): KeyboardEvent {
  return {
    key: 'z',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  } as unknown as KeyboardEvent;
}

describe('a keyboard shortcut', () => {
  it('matches its chord under either primary modifier', () => {
    const shortcut = new KeyboardShortcut('f', true);

    expect(shortcut.matches(keydown({ key: 'f', ctrlKey: true }))).toBe(true);
    expect(shortcut.matches(keydown({ key: 'F', metaKey: true }))).toBe(true);
  });

  it('does not match when a modifier it did not declare is held', () => {
    const shortcut = new KeyboardShortcut('z', true);

    expect(shortcut.matches(keydown({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(shortcut.matches(keydown({ key: 'z', ctrlKey: true, altKey: true }))).toBe(false);
  });

  // A window-level listener sees every keydown on the page, and some of
  // them arrive with no `key` — typing in a text field was enough to
  // reach one. Reading it unguarded threw out of the listener, which on
  // the way up killed the keystroke for whatever had focus.
  it('matches nothing when the event carries no key', () => {
    const shortcut = new KeyboardShortcut('z', true);

    expect(shortcut.matches(keydown({ key: undefined, ctrlKey: true }))).toBe(false);
  });
});
