import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { build, type Rollup } from 'vite';

/**
 * What importing this package costs, asked of a bundler.
 *
 * The inference library carries the whole ONNX runtime, which is the
 * heaviest dependency here by a wide margin and the only one with a
 * native binding. Reaching it from the entry point is not a matter of
 * taste: a consumer that renders captions and never transcribes pays for
 * it in download, and in Node the binding is loaded — and on musl, fails
 * to load — for code that never runs.
 *
 * A static read of the imports would only restate what the source says.
 * The question is what a bundler *resolves*, which is decided by every
 * re-export and every `import type` erasure along the way, so the bundler
 * is what gets asked. `TransformersRuntime` is the one place allowed to
 * reach the library, and it does so dynamically, which puts it in a chunk
 * of its own.
 */

const INFERENCE_RUNTIME = /@huggingface[\\/]transformers|onnxruntime/;

async function bundleEntryPoint(): Promise<Rollup.OutputChunk[]> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@modules': resolve(import.meta.dirname, 'modules') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(import.meta.dirname, 'index.ts'),
        // The entry is nothing but re-exports; an app build would shake
        // them away and measure an empty graph.
        preserveEntrySignatures: 'strict',
      },
    },
  });
  const outputs = (Array.isArray(result) ? result[0]! : result) as Rollup.RollupOutput;
  return outputs.output.filter((item): item is Rollup.OutputChunk => item.type === 'chunk');
}

function modulesOf(chunk: Rollup.OutputChunk): string[] {
  return Object.keys(chunk.modules);
}

describe('the package entry point', () => {
  it('does not pull the inference runtime into the chunk it loads eagerly', async () => {
    const chunks = await bundleEntryPoint();
    const entry = chunks.find((chunk) => chunk.isEntry);

    expect(entry).toBeDefined();
    expect(modulesOf(entry!).filter((id) => INFERENCE_RUNTIME.test(id))).toEqual([]);
  }, 120_000);

  it('still reaches the inference runtime, behind a chunk of its own', async () => {
    const chunks = await bundleEntryPoint();
    const carrying = chunks.filter((chunk) => modulesOf(chunk).some((id) => INFERENCE_RUNTIME.test(id)));

    // Without this the first assertion would also pass on a package that
    // had dropped transcription altogether, which is not the promise.
    expect(carrying.length).toBeGreaterThan(0);
    expect(carrying.every((chunk) => !chunk.isEntry)).toBe(true);
  }, 120_000);
});
