/** Writing systems the catalog ships a designed face for. */
export type FontScript = 'latin' | 'arabic' | 'hebrew' | 'urdu';

/**
 * Families that stand in for a font on the scripts it has no glyphs for,
 * keyed by script. The stand-in matching a text's script leads the emitted
 * stack, so line metrics come from the face that draws the text; the rest
 * ride along as per-glyph safety net for stray characters.
 */
export interface FontScriptFallbacks {
  readonly arabic?: string;
  readonly hebrew?: string;
  readonly urdu?: string;
}

export interface CatalogFont {
  readonly family: string;
  /** Script the family is designed for; decides which section of the picker it sits in. */
  readonly script: FontScript;
  readonly fallbacks: FontScriptFallbacks;
}

// Bundled fonts available to every template. Sourced from `@fontsource(-variable)/*`
// packages (preferred) or `src/styles/fonts/` (loaded by `fonts.css`) for families
// not on Fontsource. Adding a font here makes it pickable in every template's
// font-family universal control.
//
// Latin order is by expected usage frequency, not alphabetical: the families
// most content creators reach for first sit at the top so they're discoverable
// without scrolling. Less common but still curated families follow, grouped
// loosely by visual style (display, serif, script, mono). The other scripts
// follow underneath, each in its own picker section.
//
// Every Latin family names a stand-in for the scripts it cannot draw, chosen
// to carry the same voice: a heavy display face falls back to a heavy display
// face, a bookish serif to a bookish serif. Without this a template's font is
// simply absent for those readers and the browser substitutes whatever the
// device happens to have, which differs per machine and matches nothing the
// template intended. The stand-ins are themselves entries below, so a reader
// who knows type can pick one directly instead of inferring it.
//
// Script and handwritten faces fall back to the neutral sans rather than to
// Amiri: Amiri is a classical book face and reads solemn, and being wrong
// about formality is worse than being wrong about texture.
//
// Variable packages register their family with a "<Name> Variable" suffix
// (e.g. 'Inter Variable'); the picker label hides that detail by stripping it
// for display, while the stored value and CSS-emitted string keep the actual
// loaded family name so templates resolve to a real `@font-face`.

/**
 * Stand-ins for a family the catalog knows nothing about — a font the reader
 * uploaded. Its script coverage is unknown, so the neutral faces keep the
 * captions on a designed face instead of on whatever the device supplies.
 */
export const DEFAULT_SCRIPT_FALLBACKS: FontScriptFallbacks = {
  arabic: 'Vazirmatn Variable',
  hebrew: 'Heebo Variable',
  urdu: 'Noto Nastaliq Urdu',
};

const NEUTRAL = { arabic: 'Vazirmatn Variable', hebrew: 'Heebo Variable', urdu: 'Noto Nastaliq Urdu' } as const;
const ROUNDED = { arabic: 'Cairo Variable', hebrew: 'Assistant Variable', urdu: 'Noto Nastaliq Urdu' } as const;
const HEAVY = { arabic: 'Lalezar', hebrew: 'Heebo Variable', urdu: 'Noto Nastaliq Urdu' } as const;
const BOOKISH = { arabic: 'Amiri', hebrew: 'Assistant Variable', urdu: 'Noto Nastaliq Urdu' } as const;

const latin = (family: string, fallbacks: FontScriptFallbacks): CatalogFont =>
  ({ family, script: 'latin', fallbacks });

/** A face for a script the Latin families fall back to; it needs no stand-in of its own. */
const face = (family: string, script: FontScript): CatalogFont =>
  ({ family, script, fallbacks: {} });

export const FONT_CATALOG: readonly CatalogFont[] = [
  // Top picks — the families most caption work starts from
  latin('Inter Variable', NEUTRAL),
  latin('Poppins', ROUNDED),
  latin('Montserrat Variable', NEUTRAL),
  latin('Roboto', NEUTRAL),
  latin('Anton', HEAVY),
  latin('Bebas Neue', HEAVY),
  latin('Bangers', HEAVY),
  latin('Komika Axis', HEAVY),
  // Modern sans
  latin('Manrope Variable', NEUTRAL),
  latin('Nunito Variable', ROUNDED),
  latin('Raleway Variable', NEUTRAL),
  latin('DM Sans Variable', NEUTRAL),
  latin('Comfortaa Variable', ROUNDED),
  latin('Bricolage Grotesque Variable', NEUTRAL),
  // Display / heavy
  latin('Oswald Variable', HEAVY),
  latin('Bungee', HEAVY),
  latin('Righteous', HEAVY),
  // Serif
  latin('Playfair Display Variable', BOOKISH),
  latin('EB Garamond Variable', BOOKISH),
  latin('DM Serif Display', BOOKISH),
  latin('Fraunces Variable', BOOKISH),
  latin('Lora Variable', BOOKISH),
  // Script / cursive
  latin('Dancing Script Variable', NEUTRAL),
  latin('Pacifico', NEUTRAL),
  latin('Lobster', NEUTRAL),
  latin('Caveat Variable', NEUTRAL),
  latin('Permanent Marker', HEAVY),
  // Mono / pixel. VT323 is a thin terminal face rather than a heavy one, but
  // like the rest of the pixel/comic group it reads as novelty at caption
  // size, which the heavy Arabic display face carries better than the neutral.
  latin('JetBrains Mono Variable', NEUTRAL),
  latin('VT323', HEAVY),
  latin('Press Start 2P', HEAVY),

  // Arabic and Persian
  face('Vazirmatn Variable', 'arabic'),
  face('Cairo Variable', 'arabic'),
  face('Noto Sans Arabic Variable', 'arabic'),
  face('Noto Kufi Arabic Variable', 'arabic'),
  face('Tajawal', 'arabic'),
  face('Lalezar', 'arabic'),
  face('Amiri', 'arabic'),

  // Hebrew
  face('Heebo Variable', 'hebrew'),
  face('Assistant Variable', 'hebrew'),
  face('Rubik Variable', 'hebrew'),

  // Urdu. Nastaliq cascades each word diagonally downwards instead of sitting
  // on a flat baseline, so it needs noticeably more line height than the rest
  // of the catalog — a template tuned for Latin may need its line spacing
  // raised before Urdu captions fit.
  face('Noto Nastaliq Urdu', 'urdu'),
];
