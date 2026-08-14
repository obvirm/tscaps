import type { TimelineDetailChoices } from '@core/timeline/domain/TimelineDetail';

/**
 * Remembers what the reader has decided about the timeline's details.
 *
 * What is stored is the **decisions they made**, one per detail, and
 * never the resulting state of the panel. That is what lets each detail
 * carry its own default and lets those defaults be revised: a detail
 * nobody has touched is simply absent, so it follows whatever the build
 * says today, whether it is drawn by default or not.
 *
 * Storing the outcome instead — the set that is hidden, say — cannot do
 * this. Any reader who had ever touched anything would have a stored
 * answer for details that did not exist when they touched it, and a new
 * detail meant to start hidden would arrive shown.
 */
export interface TimelineDetailChoicesRepository {
  /** Empty when nothing was ever decided, or when storage cannot be read. */
  load(): TimelineDetailChoices;
  save(choices: TimelineDetailChoices): void;
}
