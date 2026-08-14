/**
 * What survives a worker's `postMessage` when a job fails.
 *
 * Structured clone drops `Error` subclasses, so the two useful fields
 * are sent as plain data. The name is the load-bearing one: it is how
 * a browser condition worth acting on — running out of storage, a
 * transfer dying — stays distinguishable from a generic fault once it
 * reaches the owner.
 */
export interface WorkerErrorDescription {
  readonly name: string;
  readonly message: string;
}

/**
 * A failure raised inside a worker and rebuilt on the owner thread
 * with its original `name` intact.
 */
export class WorkerBoundaryError extends Error {

  /** Flattens a thrown value into the fields that cross the boundary. */
  static describe(error: unknown, fallbackMessage: string): WorkerErrorDescription {
    if (error instanceof Error || error instanceof DOMException) {
      return { name: error.name, message: error.message };
    }
    return { name: 'Error', message: fallbackMessage };
  }

  constructor(description: WorkerErrorDescription) {
    super(description.message);
    this.name = description.name;
  }
}
