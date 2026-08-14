/**
 * How precisely the caller wants timing represented in the file.
 *
 * `segment` times whole phrases, the shape every player expects.
 * `word` asks for timing down to each word; a format satisfies that
 * however it can, so the cost differs sharply between formats — some
 * carry word timing inside a normal entry, others can only reach it by
 * emitting one entry per word.
 */
export type SubtitleGranularity = 'segment' | 'word';
