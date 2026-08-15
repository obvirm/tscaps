import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/**
 * The one promise this component makes that none of its code can keep.
 *
 * CodeMirror recognises an extension only through the `@codemirror/state`
 * instance that created it, so an install that resolves two copies makes
 * the editor throw the moment a plugin built against one is handed to a
 * view built against the other. Two copies take nothing deliberate: no
 * CodeMirror package is a direct dependency here, and one of them picking
 * up a patch bump that pulls a newer `state` while the rest of the graph
 * keeps the old one is enough.
 *
 * The question is asked of the installed graph rather than of a build,
 * because the copies need not meet in the same bundle to break the app: a
 * second copy that production tree-shakes away is still there for the dev
 * server to pre-bundle, and that is exactly how this first shipped —
 * green through typecheck, lint, build and every other test, broken the
 * moment the editor mounted.
 *
 * When this fails, the second copy has to leave both the lockfile and the
 * installed tree. Fixing the lockfile alone is not enough: pnpm reports
 * *already up to date* over the stale link, and only deleting
 * `node_modules/.pnpm-workspace-state-v1.json` makes it relink.
 */

const SINGLETON_PACKAGE = '@codemirror/state';

interface Manifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function readManifest(packageDir: string): Manifest {
  return JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as Manifest;
}

/** The directory a bare import resolves to from inside `packageDir`, or null when nothing provides it. */
function resolveDependency(packageDir: string, dependencyName: string): string | null {
  for (let dir = packageDir; ; dir = dirname(dir)) {
    const candidate =
      basename(dir) === 'node_modules'
        ? join(dir, dependencyName)
        : join(dir, 'node_modules', dependencyName);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dirname(dir) === dir) return null;
  }
}

/**
 * Every installed copy of `packageName` reachable from `rootDir`, as
 * version strings.
 *
 * The walk follows resolution rather than listing the store, because a
 * store holds directories left behind by earlier installs that nothing
 * links to any more, and those are not copies the app can load.
 */
function reachableVersionsOf(rootDir: string, packageName: string): string[] {
  const versions = new Set<string>();
  const visited = new Set<string>();
  const pending = [rootDir];

  while (pending.length > 0) {
    const packageDir = pending.pop()!;
    if (visited.has(packageDir)) continue;
    visited.add(packageDir);

    const manifest = readManifest(packageDir);
    if (manifest.name === packageName) versions.add(manifest.version ?? 'unknown');
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })) {
      const resolved = resolveDependency(packageDir, name);
      if (resolved !== null) pending.push(resolved);
    }
  }
  return [...versions].sort();
}

function appRoot(): string {
  for (let dir = import.meta.dirname; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'package.json'))) return dir;
  }
}

describe('the code editor', () => {
  it('has a single copy of the CodeMirror state package to build extensions against', () => {
    const versions = reachableVersionsOf(appRoot(), SINGLETON_PACKAGE);

    expect(versions.length, `${SINGLETON_PACKAGE} resolves to ${versions.join(' and ')}`).toBe(1);
  });
});
