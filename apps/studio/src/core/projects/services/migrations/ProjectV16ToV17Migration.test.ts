import { describe, expect, it } from 'vitest';
import { ProjectV16ToV17Migration } from '@core/projects/services/migrations/ProjectV16ToV17Migration';

/**
 * Where the one animation an element used to hold ends up now that it
 * can hold one per part of itself.
 *
 * A step that files it wrong is an element whose animation vanishes
 * from the panel while its CSS goes on rendering it — the record and
 * the text saying different things, which is the state the whole
 * design exists to prevent.
 */

const migration = new ProjectV16ToV17Migration();
const RISE = { presetId: 'rise-in', params: { distance: 0.3 } };

function migrated(elementStyles: Record<string, unknown>, elementId: string): Record<string, unknown> {
  const data = migration.migrate({ version: 16, elementStyles });
  return (data.elementStyles as Record<string, Record<string, unknown>>)[elementId] ?? {};
}

describe('the animation an element already had', () => {
  it('is filed under the element itself', () => {
    const style = migrated({ w1: { kind: 'word', entrance: RISE, css: 'animation: rise;' } }, 'w1');
    expect(style.animations).toEqual({ self: RISE });
  });

  it('stops being recorded under the name it used to have', () => {
    const style = migrated({ w1: { kind: 'word', entrance: RISE, css: '' } }, 'w1');
    expect(style.entrance).toBeUndefined();
  });

  it('keeps the CSS it already wrote, which is the same block its part builds', () => {
    const style = migrated({ w1: { kind: 'word', entrance: RISE, css: 'animation: rise;' } }, 'w1');
    expect(style.css).toBe('animation: rise;');
  });

  it('carries an element told not to move across as the answer it is', () => {
    const disabled = { presetId: null, params: {} };
    const style = migrated({ w1: { kind: 'word', entrance: disabled, css: 'animation: none;' } }, 'w1');
    expect(style.animations).toEqual({ self: disabled });
  });
});

describe('an element the step has nothing to do for', () => {
  it('comes through with no animations at all when it never had one', () => {
    const style = migrated({ w1: { kind: 'word', css: 'color: gold;' } }, 'w1');
    expect(style).toEqual({ kind: 'word', css: 'color: gold;' });
  });

  it('keeps every other part of the style untouched', () => {
    const placement = { verticalAlign: 'top', verticalOffset: 0.1, horizontalAlign: 'left', horizontalOffset: 0.2 };
    const style = migrated({ w1: { kind: 'word', entrance: RISE, fields: { italic: 1 }, placement, css: '' } }, 'w1');
    expect(style.fields).toEqual({ italic: 1 });
    expect(style.placement).toEqual(placement);
  });

  it('leaves the payload without the key when no element is styled at all', () => {
    expect(migration.migrate({ version: 16 }).elementStyles).toBeUndefined();
  });
});
