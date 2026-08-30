/**
 * Where the worker fetches MediaPipe's Tasks Vision bundle and its two
 * models from, and which backend runs them.
 *
 * Locations are a deployment choice, not a property of the detector: a
 * page served to a browser reads them off a public CDN, while a host
 * that has to answer offline serves its own copies. The values reach
 * MediaPipe unchanged, so they must be resolvable from the worker's
 * origin.
 */
export interface PersonSegmenterModelLocations {
  /** Directory holding `vision_wasm_internal.js` and its `.wasm`. */
  readonly wasmPath: string;
  readonly poseModelUrl: string;
  readonly segmenterModelUrl: string;
  /**
   * `GPU` needs WebGL2 inside the worker; `CPU` runs anywhere and is
   * the only option where WebGL2 is missing or software-emulated.
   */
  readonly delegate: 'CPU' | 'GPU';
}
