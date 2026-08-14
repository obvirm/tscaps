/**
 * The name every field answers to.
 *
 * An id is the key a value is recorded under, so it outlives the class
 * that emits the declaration and is read by code that has no reason to
 * know a field class exists — the font collector asking which face an
 * element was given, a migration writing values it will never render.
 * Spelled once here so those readers and the field cannot drift apart
 * in silence: a value recorded under a name nothing offers is a
 * declaration nobody can take back out.
 */
export enum ElementFieldId {
  ITALIC = 'italic',
  UNDERLINE = 'underline',
  STRIKETHROUGH = 'strikethrough',
  FONT_FAMILY = 'font-family',
  FONT_SIZE = 'font-size',
  RELATIVE_SIZE = 'relative-size',
  FONT_WEIGHT = 'font-weight',
  PRIMARY_COLOR = 'primary-color',
  ROTATION = 'rotation',
}
