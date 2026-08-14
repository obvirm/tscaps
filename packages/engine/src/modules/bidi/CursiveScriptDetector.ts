// Scripts whose letters connect to their neighbours, so a letter takes a
// different shape depending on what sits beside it. Listed by Unicode script
// property rather than by codepoint range, and by `Script_Extensions` so the
// letters Persian and Urdu add to the Arabic script come along. Hebrew, Thaana
// and Divehi are right-to-left but do not join, so they are absent on purpose.
const CURSIVE_SCRIPTS =
  /[\p{Script_Extensions=Arabic}\p{Script=Syriac}\p{Script=Mongolian}\p{Script=Nko}\p{Script=Adlam}\p{Script=Mandaic}\p{Script=Hanifi_Rohingya}]/u;

/**
 * Tells whether a text is written in a script whose letters join up.
 *
 * Text like that cannot be broken into independently painted letters:
 * each letter would be shaped in isolation, the connections between
 * them would disappear, and the word would read as a row of unrelated
 * marks.
 */
export class CursiveScriptDetector {

  isCursive(text: string): boolean {
    return CURSIVE_SCRIPTS.test(text);
  }
}
