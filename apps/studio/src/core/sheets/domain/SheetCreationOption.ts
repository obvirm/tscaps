import type { SheetRole } from '@core/sheets/domain/SheetRole';

/**
 * A sheet the project could add that is not the blank one anybody can
 * always make: the platform already knows what would go in it and what
 * it would look like, so it can be offered by name.
 *
 * The two kinds differ in every respect but that. A role is unique per
 * project, brings its own look, and takes the words its tag marked. A
 * speaker repeats as many times as the transcript has voices, is a copy
 * of Main on a different preset, and takes whole scenes.
 */
export type SheetCreationOption =
  | { readonly kind: 'role'; readonly role: SheetRole }
  | {
    readonly kind: 'speaker';
    readonly speakerId: string;
    /** Name the sheet is created with, and the one the menu shows. */
    readonly name: string;
    /** Position among the transcript's voices, which picks the preset. */
    readonly position: number;
  };
