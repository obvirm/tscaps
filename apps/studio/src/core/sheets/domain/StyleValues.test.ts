import { describe, expect, it } from 'vitest';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import { StyleValues } from '@core/sheets/domain/StyleValues';

const FIELDS = [
  { id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff' },
  { id: 'behind-font-family', label: 'Behind font', type: 'font', default: 'Anton' },
] as unknown as ControlField[];

function valuesOf(styleValues: StyleValues): Record<string, unknown> {
  return Object.fromEntries([...styleValues.entries()].map(([field, value]) => [field.id, value]));
}

describe('StyleValues', () => {

  it('seeds every field from its default', () => {
    expect(valuesOf(StyleValues.fromTemplate(FIELDS)))
      .toEqual({ 'primary-color': '#ffffff', 'behind-font-family': 'Anton' });
  });

  describe('restoring a snapshot', () => {

    it('keeps what was stored', () => {
      const restored = StyleValues.restoredFrom(FIELDS, { 'primary-color': '#e6d647', 'behind-font-family': 'Bungee' });
      expect(valuesOf(restored)).toEqual({ 'primary-color': '#e6d647', 'behind-font-family': 'Bungee' });
    });

    // A control the template gained after the snapshot was taken. Left
    // unset it publishes no custom property, and everything downstream
    // that reads the published set behaves as though it did not exist.
    it('fills a field the snapshot never had with its default', () => {
      const restored = StyleValues.restoredFrom(FIELDS, { 'primary-color': '#e6d647' });
      expect(valuesOf(restored)).toEqual({ 'primary-color': '#e6d647', 'behind-font-family': 'Anton' });
    });

    it('ignores a stored key no field answers to', () => {
      const restored = StyleValues.restoredFrom(FIELDS, { 'gone-from-the-template': 'x' });
      expect(valuesOf(restored)).toEqual({ 'primary-color': '#ffffff', 'behind-font-family': 'Anton' });
    });
  });
});
