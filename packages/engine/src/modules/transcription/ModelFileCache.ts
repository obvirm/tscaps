/**
 * Local store for the model files a transcriber downloads, so a later
 * run reads them back instead of fetching them again.
 *
 * Both operations are best-effort by contract: a store that cannot
 * answer reports a miss, and a store that cannot keep a file resolves
 * anyway. Neither ever rejects. Losing the copy costs a download on
 * the next run, which is worth far less than the transcription in
 * flight.
 *
 * Keys are opaque strings chosen by the caller and must round-trip
 * verbatim between `put` and `match`.
 */
export interface ModelFileCache {
  /** The stored file, or `undefined` when this key was never kept. */
  match(key: string): Promise<Response | undefined>;

  /** Keeps `response` under `key`, replacing nothing already there. */
  put(key: string, response: Response): Promise<void>;
}
