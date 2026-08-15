import type * as Transformers from '@huggingface/transformers';
import type { ModelFileCache } from '@modules/transcription/ModelFileCache';

/**
 * The inference library, loaded on first use and configured once.
 *
 * It is reached through a dynamic import because a static one makes the
 * whole ONNX runtime a dependency of merely *naming* a transcriber: the
 * package's entry point re-exports this module, so a consumer that
 * imports a document node pulls the runtime with it. In a browser that
 * is a large bundle nobody asked for; in Node it is a native binding
 * loaded — and on musl, failed — for code that never runs inference.
 *
 * The environment settings live here rather than at the call site
 * because they have to be applied before the first pipeline is built and
 * exactly once. Holding the module and the settings together is what
 * makes "loaded" and "configured" the same event.
 *
 * A failed load is not cached: the import can fail on a dead network the
 * same way the weights can, and a caller retrying deserves to reach the
 * network again.
 */
export class TransformersRuntime {
  private modulePromise: Promise<typeof Transformers> | null = null;

  constructor(private readonly modelFileCache?: ModelFileCache) {}

  /**
   * Resolves with the library, configured. Concurrent callers share one
   * load, and the settings are applied before any of them sees it.
   */
  load(): Promise<typeof Transformers> {
    if (this.modulePromise === null) {
      const attempt = import('@huggingface/transformers').then((module) => {
        this.configure(module.env);
        return module;
      });
      attempt.catch(() => {
        if (this.modulePromise === attempt) this.modulePromise = null;
      });
      this.modulePromise = attempt;
    }
    return this.modulePromise;
  }

  private configure(env: typeof Transformers.env): void {
    env.allowLocalModels = false;
    this.installModelFileCache(env);
    this.configureWasmThreading(env);
  }

  /**
   * Takes over where the downloaded model files are kept.
   *
   * Left to itself the library picks a store from the environment and
   * discards a refused write with nothing but a console warning, so a
   * caller that wants to know when the files did not survive the run
   * has to own the store. Without one, that default stands.
   */
  private installModelFileCache(env: typeof Transformers.env): void {
    if (!this.modelFileCache) return;
    env.useCustomCache = true;
    env.customCache = this.modelFileCache;
  }

  /**
   * Raises the WASM thread count above ORT's built-in ceiling when the
   * runtime supports it. ORT locks the count to 1 without cross-origin
   * isolation, and even with isolation its own default caps at 4 no matter
   * the machine — Whisper's encoder scales past that. On a WebGPU run this
   * has no effect; the WASM backend is not touched.
   */
  private configureWasmThreading(env: typeof Transformers.env): void {
    if (typeof self === 'undefined' || !self.crossOriginIsolated) return;
    const wasm = env.backends.onnx.wasm;
    if (!wasm) return;
    wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 8);
  }
}
