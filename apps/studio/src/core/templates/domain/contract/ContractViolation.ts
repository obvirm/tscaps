/**
 * A single breach of the styling contract found in template source.
 * The message is written for the template author: it names the
 * offending identifier and why nothing can satisfy it.
 */
export interface ContractViolation {
  readonly message: string;
}
