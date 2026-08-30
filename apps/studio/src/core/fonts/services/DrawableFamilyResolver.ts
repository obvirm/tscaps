import type { FontScript } from '@core/fonts/domain/FontCatalog';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';

/**
 * Reads a `font-family` stack and answers which of its families can end
 * up drawing something, given the scripts the text on screen holds.
 *
 * A chosen font arrives with the stand-ins covering the scripts it
 * cannot draw appended to it, and a caption mixing scripts renders in
 * more than one of them — so taking only the first family would leave
 * those faces out.
 *
 * Which is an argument for the scripts that are on screen and for no
 * others: a stand-in for a script the text holds no character of loses
 * every fallback contest, yet its Latin subset still covers the text
 * and would pass any filter that only looked at coverage.
 */
export class DrawableFamilyResolver {

  constructor(private readonly fontStackResolver: FontStackResolver) {}

  /**
   * The families of `stack`, in the order it lists them, minus the
   * stand-ins none of `scripts` can reach.
   *
   * The stack's leader is always kept, and so is any name the leader
   * claims no stand-in for — that one is somebody's chosen face, or a
   * family this resolution knows nothing about, and either way nothing
   * says it goes unused.
   */
  resolve(stack: string, scripts: ReadonlySet<FontScript>): string[] {
    const names = stack.split(',').map((family) => this.unquote(family.trim())).filter(Boolean);
    const leader = names[0];
    if (leader === undefined) return [];
    const standIns = this.fontStackResolver.standInsByScript(leader);
    return [leader, ...names.slice(1).filter((name) => this.canDraw(name, standIns, scripts))];
  }

  private canDraw(
    name: string,
    standIns: ReadonlyMap<FontScript, string>,
    scripts: ReadonlySet<FontScript>,
  ): boolean {
    const standsInFor = [...standIns.entries()]
      .filter(([, family]) => family === name)
      .map(([script]) => script);
    if (standsInFor.length === 0) return true;
    return standsInFor.some((script) => scripts.has(this.writingSystemOf(script)));
  }

  /**
   * The script whose presence in the text makes a stand-in reachable.
   * Urdu is the Arabic script written in another tradition and no letter
   * separates them, so Arabic characters keep the Nastaliq face in play.
   */
  private writingSystemOf(script: FontScript): FontScript {
    return script === 'urdu' ? 'arabic' : script;
  }

  /**
   * Strips wrapping single/double quotes. Sheet inline-style values
   * for font controls arrive quoted (`'Press Start 2P'`) since
   * digit-leading idents are otherwise invalid CSS; the bare name is
   * what matches the bundled `@font-face` declarations.
   */
  private unquote(value: string): string {
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      return value.slice(1, -1);
    }
    return value;
  }
}
