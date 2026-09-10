import { CssScoper } from '@tscaps/engine';
import { CssVarReferenceScanner } from '@tscaps/engine';
import { readFileSync } from 'node:fs';

const css = readFileSync('E:/project/tscaps/templates/zara/style.build.css', 'utf8');
const scoper = new CssScoper();
const scoped = scoper.scope(css, '.tscaps-scope-test');
const idx = scoped.indexOf('text-shadow');
console.log('=== scoped text-shadow rule ===');
console.log(scoped.slice(Math.max(0, idx - 200), idx + 1400));
console.log('=== var scan ===');
const scanner = new CssVarReferenceScanner();
const used = scanner.scan(scoped);
for (const v of ['--tscaps-split-x', '--tscaps-glow-radius', '--tscaps-split-color-a', '--tscaps-font-family']) {
  console.log(v, used.has(v) ? 'USED' : 'DROPPED');
}
