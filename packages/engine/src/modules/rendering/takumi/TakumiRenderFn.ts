/**
 * Injectable Takumi `render()` signature.
 *
 * Satisfied by `import { render } from 'takumi-js'`, which accepts JSX, an
 * HTML string, or a node tree and resolves PNG bytes. This renderer passes
 * an HTML string plus a `css` array so template stylesheets flow through
 * without a JSX build step. In browsers `takumi-js` self-selects its WASM
 * build; in Node it uses the native binding.
 *
 * Injectable (rather than a hard import) so the engine ships zero new
 * mandatory dependencies and the renderer stays unit-testable.
 */
export interface TakumiRenderOptions {
  readonly width: number;
  readonly height: number;
  readonly css: ReadonlyArray<string>;
  /** Animation-timeline position in ms; time-driven template CSS resolves against it. */
  readonly timeMs: number;
  /**
   * Opaque font entries for the Takumi backend (e.g. `googleFonts(...)`
   * results). `unknown` keeps the engine decoupled from `takumi-js`;
   * the caller adapts its own font values.
   */
  readonly fonts?: ReadonlyArray<unknown>;
}

export type TakumiRenderFn = (
  node: string,
  options: TakumiRenderOptions,
) => Promise<Uint8Array>;

/**
 * Turns Takumi PNG bytes into something `SubtitleFrame.draw` can paint.
 * The default uses `createImageBitmap`; tests inject a stub.
 */
export type TakumiBitmapDecoder = (png: Uint8Array) => Promise<CanvasImageSource>;
