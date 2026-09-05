import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // takumi-js resolves its .wasm relative to import.meta.url; esbuild
  // pre-bundling would rebase that URL into .vite/deps and 404 it.
  // @tscaps/engine is a file:.. link whose content changes without a
  // version bump, which the optimizer cache cannot see — always serve it
  // fresh so engine rebuilds take effect.
  optimizeDeps: {
    exclude: ['takumi-js', '@takumi-rs/wasm', '@tscaps/engine'],
  },
  build: {
    rollupOptions: {
      input: {
        index: path.join(here, 'index.html'),
        fromText: path.join(here, 'from-text/index.html'),
        transcribe: path.join(here, 'transcribe/index.html'),
        cssAlignment: path.join(here, 'css-alignment/index.html'),
        cliRunner: path.join(here, 'cli/runner.html'),
        cliTakumiRunner: path.join(here, 'cli/takumi-runner.html'),
        cliReadmeRunner: path.join(here, 'cli/readme-runner.html'),
      },
    },
  },
});
