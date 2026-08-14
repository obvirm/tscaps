import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyleSurface } from '@core/elements/domain/ElementStyleSurface';
import type { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import type { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';

/**
 * One thing an element can be told about its own look, and the
 * declaration that tells it.
 *
 * A field owns both halves on purpose: what it means, which is the
 * same wherever it appears, and how it reaches the style on each kind
 * of surface, which is not. Keeping them together is what stops a word
 * and a segment from ending up with the same field under two names or
 * two sets of bounds, and it puts the reason a size is a percentage
 * here and a share of the frame there next to both of them.
 *
 * Every field writes a declaration. Anything an element carries that
 * never becomes one — where it sits, how it arrives — is not a field
 * and is not described here.
 */
export interface ElementField {
  readonly id: ElementFieldId;

  /**
   * Which part of an element's look this belongs to, which is the same
   * on every kind of element that offers it. A kind says what it
   * offers and never how it is arranged, so two of them cannot file
   * one field under two headings.
   */
  readonly section: ElementFieldSection;

  /** The field as it appears on an element that reaches style this way. */
  controlFor(surface: ElementStyleSurface): AuthoredElementControl;

  /**
   * Whether a value recorded on an element further out arrives here on
   * its own.
   *
   * Not quite the same question as whether the property inherits: a
   * wrapper reaches the text through a custom property, and those
   * always inherit. What decides it is whether the value the ancestor
   * was given is already in what this element renders at.
   *
   * A field that says yes shows the nearest ancestor's answer while it
   * has none of its own. One that says no starts from its own neutral,
   * because the ancestor's answer is already folded in — a ratio is
   * taken against a parent that has already grown, and a rotation
   * composes with the one around it rather than replacing it. Showing
   * the outer number on either would offer a value that renders as
   * something else the moment it is committed unchanged.
   */
  inheritsFromAncestor(): boolean;
}
