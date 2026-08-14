/** Something the timeline draws that the reader can turn off. */
export type TimelineDetail = 'waveform';

/**
 * Whether each detail is drawn before the reader has said anything about
 * it.
 *
 * The timeline is a document first. What a casual reader should meet is
 * their words against the clock, and every further band is precision
 * they can ask for once they know they want it — so a detail earns its
 * place here by being useful before anyone has learnt what it is.
 */
export const TIMELINE_DETAIL_SHOWN_BY_DEFAULT: Readonly<Record<TimelineDetail, boolean>> = {
  waveform: false,
};

/** Every detail this build publishes. */
export const TIMELINE_DETAILS = Object.keys(
  TIMELINE_DETAIL_SHOWN_BY_DEFAULT,
) as ReadonlyArray<TimelineDetail>;

/**
 * What the reader has decided, for the details they have decided about.
 * A detail missing here has never been touched and follows its default.
 */
export type TimelineDetailChoices = Readonly<Partial<Record<TimelineDetail, boolean>>>;
