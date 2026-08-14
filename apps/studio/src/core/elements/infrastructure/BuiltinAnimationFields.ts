import { AnimationFieldCatalog } from '@core/elements/domain/AnimationFieldCatalog';

// Authored beside each animation rather than generated, so they are
// globbed straight out of the library. Every animation carries the
// file, with `[]` where it offers no fields — including the ones the
// picker never lists, which a template still applies.
const fieldModules = import.meta.glob('../../../../../../templates/_lib/animation/*/controls.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export const BUILTIN_ANIMATION_FIELDS: AnimationFieldCatalog = AnimationFieldCatalog.byFolder(fieldModules);
