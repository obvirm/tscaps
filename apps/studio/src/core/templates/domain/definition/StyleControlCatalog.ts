import type { ControlField, ControlGroup, ControlSubgroup, ControlFieldType, ControlUnit, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';

/**
 * Everything about a style control except the one thing a template
 * chooses: its default. Label, type, unit, group and the dial's bounds
 * describe the concept, so two templates exposing the same control
 * must present it identically — a divergence there is drift, not
 * design.
 *
 * When a template genuinely needs different bounds, that is evidence
 * the quantity is a different concept and wants its own id, not that
 * the bounds belong to the template. A blur radius and a Gaussian
 * standard deviation are not the same control with different ranges.
 */
export interface StyleControlConcept {
  readonly label: string;
  readonly type: ControlFieldType;
  readonly unit?: ControlUnit;
  readonly group?: ControlGroup;
  readonly subgroup?: ControlSubgroup;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly legend?: string;
  /** For `toggle`: the CSS values its two states emit. */
  readonly valueOn?: string;
  readonly valueOff?: string;
}

const CONCEPTS: Readonly<Record<string, StyleControlConcept>> = {
  'shadow-color': {
    label: 'Shadow',
    type: 'color',
    group: 'style',
    subgroup: 'colors',
  },
  'shadow-distance': {
    label: 'Shadow distance',
    type: 'float',
    unit: 'em',
    group: 'style',
    subgroup: 'appearance',
    min: 0,
    max: 1.0,
    step: 0.01,
  },
  'dynamic-font-size': {
    label: 'Dynamic font size',
    type: 'toggle',
    group: 'style',
    subgroup: 'appearance',
    valueOn: '12',
    valueOff: '0',
    legend: 'Grows the font size on short captions so they fill the screen.',
  },
  'show-caret': {
    label: 'Show caret',
    type: 'toggle',
    group: 'style',
    subgroup: 'appearance',
    valueOn: 'block',
    valueOff: 'none',
  },
  'shadow-blur': {
    label: 'Shadow blur',
    type: 'float',
    unit: 'em',
    group: 'style',
    subgroup: 'appearance',
    min: 0,
    max: 2.0,
    step: 0.01,
  },
  'filter-shadow-distance': {
    label: 'Shadow distance',
    type: 'float',
    unit: 'em',
    group: 'style',
    subgroup: 'appearance',
    min: 0,
    max: 0.3,
    step: 0.01,
  },
  'filter-shadow-blur': {
    label: 'Shadow blur',
    type: 'float',
    unit: 'em',
    group: 'style',
    subgroup: 'appearance',
    min: 0,
    max: 0.3,
    step: 0.005,
  },
};

/**
 * The canonical vocabulary of style controls a CSS primitive may
 * declare on its caller's behalf.
 *
 * A primitive that reads `--tscaps-<id>` declares the matching control
 * through this catalog, so a template gets the control by using the
 * primitive rather than by knowing it has to. The template supplies
 * the default — the part that is its look — and nothing else.
 */
export class StyleControlCatalog {
  constructor(private readonly similarNameFinder: SimilarNameFinder) {}

  has(id: string): boolean {
    return id in CONCEPTS;
  }

  ids(): readonly string[] {
    return Object.keys(CONCEPTS);
  }

  /**
   * Builds the control a template declares by using `id` with
   * `defaultValue` as its look. Throws when the id is not catalogued:
   * a primitive reading a variable nobody describes would produce a
   * control the editor cannot render.
   */
  fieldFor(id: string, defaultValue: ControlValue): ControlField {
    const concept = CONCEPTS[id];
    if (concept === undefined) throw new Error(this.unknownIdMessage(id));
    return { id, default: defaultValue, ...concept };
  }

  private unknownIdMessage(id: string): string {
    const suggestions = this.similarNameFinder.closestTo(id, Object.keys(CONCEPTS));
    const didYouMean = suggestions.length === 0
      ? ''
      : ` Did you mean ${suggestions.map((candidate) => `"${candidate}"`).join(' or ')}?`;
    return (
      `No style control named "${id}".${didYouMean}`
      + ` A control must be described before a stylesheet can declare it:`
      + ` add "${id}" to CONCEPTS in StyleControlCatalog.ts with its label, type,`
      + ` unit, group and bounds. Everything except the default lives there,`
      + ` so every template presents the control the same way.`
    );
  }
}
