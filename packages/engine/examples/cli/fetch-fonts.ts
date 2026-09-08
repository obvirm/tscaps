// Downloads every gallery display family once via takumi-js helpers and
// stores raw subset files + a manifest under input/fonts/. The matrix page
// then loads fonts from these local bytes on both sides (Takumi FontDetails
// and document FontFace), eliminating per-run Google Fonts DNS flakiness
// that made matrix widths nondeterministic.
// NOTE: after downloading, run `python cli/strip-hollow-gsub.py` — Google's
// subsetter leaves hollow zero-coverage GSUB shells that make Takumi reject
// the whole file (proven with VT323: fallback until the GSUB was dropped).
// Usage: pnpm exec tsx cli/fetch-fonts.ts
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { googleFonts } from 'takumi-js/helpers';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(HERE, '..', 'input', 'fonts');

const FAMILIES = [
  'Playfair Display', 'Lora', 'Bebas Neue', 'Inter', 'Anton', 'Gabarito',
  'Bricolage Grotesque', 'JetBrains Mono', 'Caveat', 'Bungee', 'Lobster',
  'Poppins', 'Righteous', 'VT323', 'Manrope', 'IM Fell English',
  'Montserrat',
];
// Komika Axis is not on Google Fonts; it ships in this workspace.
const KOMIKA_SRC = 'E:/project/tscaps/apps/studio/src/styles/fonts/komika-axis.woff2';

interface ManifestEntry {
  file: string;
  name: string;
  subsetOf: string;
  weight: number | undefined;
  style: string | undefined;
  ranges: ReadonlyArray<readonly [number, number]>;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function main(): Promise<void> {
  mkdirSync(FONTS_DIR, { recursive: true });
  const manifest: Record<string, ManifestEntry[]> = {};
  for (const family of FAMILIES) {
    try {
      const subsets = (await googleFonts([{ name: family }])) as unknown as Array<{
        name: string;
        subsetOf: string;
        weight?: number;
        style?: string;
        ranges: ReadonlyArray<readonly [number, number]>;
        data: () => Promise<ArrayBuffer>;
      }>;
      manifest[family] = [];
      for (const subset of subsets) {
        const file = `${slug(family)}-${slug(subset.name)}.woff2`;
        const bytes = Buffer.from(await subset.data());
        writeFileSync(path.join(FONTS_DIR, file), bytes);
        manifest[family]!.push({
          file,
          name: subset.name,
          subsetOf: subset.subsetOf,
          weight: subset.weight,
          style: subset.style,
          ranges: subset.ranges,
        });
      }
      console.log(`${family}: ${subsets.length} subsets`);
    } catch (err) {
      console.error(`${family}: FAILED ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  writeFileSync(path.join(FONTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('manifest written');
  if (existsSync(KOMIKA_SRC)) {
    copyFileSync(KOMIKA_SRC, path.join(FONTS_DIR, 'komika-axis.woff2'));
    manifest['Komika Axis'] = [{
      file: 'komika-axis.woff2',
      name: 'Komika Axis',
      subsetOf: 'Komika Axis',
      weight: undefined,
      style: undefined,
      ranges: [[0, 1114111]],
    }];
    writeFileSync(path.join(FONTS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('komika added');
  }
}

await main();
