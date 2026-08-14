import type { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import type { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import type { StyledElementType } from '@core/elements/domain/types/StyledElementType';

/** One heading's worth of an element's fields, in the order they are drawn. */
export interface ElementControlSection {
  readonly section: ElementFieldSection;
  readonly controls: ReadonlyArray<AuthoredElementControl>;
}

/**
 * What each kind of addressable element can be told about itself.
 *
 * The one place anything asks. A panel asks what to draw, the store
 * asks what a recorded value belongs to, and the CSS writer asks which
 * declaration a field drives — all of them from here, so a new kind of
 * element is a new entry rather than a new branch in each of them.
 *
 * Every kind has an entry. A kind that answered nothing would render
 * no fields at all, which reads on screen exactly like an element that
 * has nothing to offer.
 */
export class StyledElementCatalog {
  constructor(private readonly typesByKind: Readonly<Record<ElementKind, StyledElementType>>) {}

  /** The fields the kind offers, in the order they are drawn. */
  controlsFor(kind: ElementKind): ReadonlyArray<AuthoredElementControl> {
    const type = this.typesByKind[kind];
    return type.fields().map((field) => field.controlFor(type.surface));
  }

  /**
   * The same fields under the headings they belong to, each section in
   * the order its first field was offered and each field in the order
   * it was offered.
   *
   * A kind that offers nothing from a section has no entry for it, so
   * a panel never draws an empty heading.
   */
  sectionsFor(kind: ElementKind): ReadonlyArray<ElementControlSection> {
    const type = this.typesByKind[kind];
    const bySection = new Map<ElementFieldSection, AuthoredElementControl[]>();
    for (const field of type.fields()) {
      const controls = bySection.get(field.section) ?? [];
      controls.push(field.controlFor(type.surface));
      bySection.set(field.section, controls);
    }
    return [...bySection].map(([section, controls]) => ({ section, controls }));
  }

  /** The fields themselves, for what a control cannot answer on its own. */
  fieldsFor(kind: ElementKind): ReadonlyArray<ElementField> {
    return this.typesByKind[kind].fields();
  }

  /** How the kind's declarations reach the text that gets painted. */
  surfaceOf(kind: ElementKind): ElementStyleSurface {
    return this.typesByKind[kind].surface;
  }

  /** Which of the kind's parts can be given an animation, in the order they are drawn. */
  animationScopesFor(kind: ElementKind): ReadonlyArray<ElementAnimationScope> {
    return this.typesByKind[kind].animationScopes();
  }

  /**
   * Whether what one kind is told about this field arrives on its own
   * at the elements inside it.
   *
   * `false` for a field whose value composes with the ones around it
   * instead of replacing them — a ratio and a rotation are already
   * taken against everything further out.
   */
  reachesInside(kind: ElementKind, control: AuthoredElementControl): boolean {
    return this.fieldsFor(kind).some((field) => field.id === control.id && field.inheritsFromAncestor());
  }

  /** The same field as another element wears it, or `null` when this kind does not offer it. */
  sameFieldOn(kind: ElementKind, control: AuthoredElementControl): AuthoredElementControl | null {
    return this.controlsFor(kind).find((own) => own.id === control.id) ?? null;
  }

  /** The one field, or `null` when the kind does not offer it. */
  controlFor(kind: ElementKind, fieldId: ElementFieldId): AuthoredElementControl | null {
    return this.controlsFor(kind).find((control) => control.id === fieldId) ?? null;
  }

  /**
   * The one field, for a caller that only writes elements it knows
   * carry it.
   *
   * Throws rather than returning nothing, because the alternative is a
   * handle that answers to the pointer and changes nothing on screen.
   */
  requireControl(kind: ElementKind, fieldId: ElementFieldId): AuthoredElementControl {
    const control = this.controlFor(kind, fieldId);
    if (!control) throw new Error(`A ${kind} offers no "${fieldId}" field.`);
    return control;
  }

  /** Whether the kind can be taken out of the line flow and anchored in the frame. */
  canBePlaced(kind: ElementKind): boolean {
    return this.typesByKind[kind].canBePlaced();
  }
}
