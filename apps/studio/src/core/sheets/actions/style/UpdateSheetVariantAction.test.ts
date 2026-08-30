import { describe, expect, it } from 'vitest';
import type { AlignmentConfig, SvgFilterDefinitions } from '@tscaps/engine';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { Sheet } from '@core/sheets/domain/Sheet';
import { StyleValues } from '@core/sheets/domain/StyleValues';
import { ROTATION_DEFAULTS } from '@core/sheets/domain/RotationConfig';
import { TYPOGRAPHY_DEFAULTS } from '@core/sheets/domain/TypographyConfig';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import type { FeaturesConfig } from '@core/templates/domain/definition/FeaturesConfig';
import type { RenderingConfig } from '@core/templates/domain/definition/RenderingConfig';
import type { StyleVariants } from '@core/templates/domain/definition/StyleVariant';
import type { TemplateMetadata } from '@core/templates/domain/TemplateMetadata';
import { Template } from '@core/templates/domain/Template';
import { UpdateSheetVariantAction } from '@core/sheets/actions/style/UpdateSheetVariantAction';

/**
 * Picking a preset for the active sheet.
 *
 * The picker offers the presets the current template ships and marks the
 * one showing, while the sheet holds the preset it wants — which can be
 * one this template does not have. So the pick that names what is
 * already on screen is not a choice, and must leave that preference
 * where it is; any other pick is one, and replaces it.
 */

const TEXT_COLOR: ControlField = {
  id: 'primary-color', label: 'Text', type: 'color', default: '#ffffff', group: 'style', subgroup: 'colors',
};

const TWO_PRESETS: StyleVariants = [
  { label: 'A', overrides: { 'primary-color': '#aaaaaa' } },
  { label: 'B', overrides: { 'primary-color': '#bbbbbb' } },
];

const ALIGNMENT: AlignmentConfig = {
  verticalAlign: 'bottom', verticalOffset: 0, horizontalAlign: 'left', horizontalOffset: 0,
};

const template = new Template(
  { id: 'two-presets', category: 'lab' } as unknown as TemplateMetadata,
  TYPOGRAPHY_DEFAULTS,
  ROTATION_DEFAULTS,
  ALIGNMENT,
  {} as RenderingConfig,
  {} as FeaturesConfig,
  {} as BehindActorTemplateConfig,
  [],
  [],
  { mode: 'none' } as unknown as LineSplitterConfig,
  [TEXT_COLOR],
  TWO_PRESETS,
  {} as SvgFilterDefinitions,
  '',
  '',
  [],
);

const refresh = { execute: () => {} } as unknown as RefreshDocumentAction;

/** A sheet wanting the fourth preset while sitting on a template with two. */
function storeShowingSheetWanting(variantIndex: number): EditorStore {
  const store = new EditorStore();
  store.patch({
    sheets: [new Sheet({
      id: 'main',
      name: 'Speaker 4',
      color: null,
      template,
      variantIndex,
      styleValues: StyleValues.fromTemplateVariant(template, variantIndex),
      typographyConfig: TYPOGRAPHY_DEFAULTS,
      rotationConfig: ROTATION_DEFAULTS,
      segmentSplitterConfigs: [],
      lineSplitterConfig: { mode: 'none' } as unknown as LineSplitterConfig,
      alignmentConfig: ALIGNMENT,
      effectConfigs: [],
    })],
    activeSheetId: 'main',
  });
  return store;
}

function activeSheet(store: EditorStore): Sheet {
  return store.snapshot().sheets[0]!;
}

describe('picking a style variant', () => {
  it('leaves the sheet alone when the pick is the preset already showing', () => {
    const store = storeShowingSheetWanting(3);
    const before = activeSheet(store);

    new UpdateSheetVariantAction(store, refresh).execute(1);

    expect(activeSheet(store)).toBe(before);
    expect(activeSheet(store).variantIndex).toBe(3);
  });

  it('takes over the preference when the pick is a different preset', () => {
    const store = storeShowingSheetWanting(3);

    new UpdateSheetVariantAction(store, refresh).execute(0);

    expect(activeSheet(store).variantIndex).toBe(0);
    expect(activeSheet(store).styleValues.values['primary-color']).toBe('#aaaaaa');
  });
});
