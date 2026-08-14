export enum StructureTag {
  // Word-level
  FIRST_WORD_IN_SECTION = 'first-word-in-section',
  LAST_WORD_IN_SECTION = 'last-word-in-section',
  FIRST_WORD_IN_SEGMENT = 'first-word-in-segment',
  LAST_WORD_IN_SEGMENT = 'last-word-in-segment',
  FIRST_WORD_IN_LINE = 'first-word-in-line',
  LAST_WORD_IN_LINE = 'last-word-in-line',

  // Line-level
  FIRST_LINE_IN_SECTION = 'first-line-in-section',
  LAST_LINE_IN_SECTION = 'last-line-in-section',
  FIRST_LINE_IN_SEGMENT = 'first-line-in-segment',
  LAST_LINE_IN_SEGMENT = 'last-line-in-segment',

  // Segment-level
  FIRST_SEGMENT_IN_SECTION = 'first-segment-in-section',
  LAST_SEGMENT_IN_SECTION = 'last-segment-in-section',
  FIRST_SEGMENT_IN_DOCUMENT = 'first-segment-in-document',
  LAST_SEGMENT_IN_DOCUMENT = 'last-segment-in-document',
  SEGMENT_AFTER_PAUSE = 'segment-after-pause',
}
