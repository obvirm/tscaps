/**
 * Subtitle file formats the editor offers.
 *
 * Each value names a format the engine has a serializer for, and the
 * registry is where the two lists are held in step. The engine may
 * write formats absent here: a serializer earns its place in this union
 * once its output has been opened in the software that consumes it.
 *
 * TTML is written by the engine and deliberately left out. The name
 * covers a family — TTML1, TTML2, IMSC1, SMPTE-TT, EBU-TT-D — whose
 * members disagree on what a valid document carries, and several
 * consumers refuse one that declares no profile or region. Offering it
 * before opening the output in a real workflow would be a guess.
 */
export type SubtitleFileFormat = 'srt' | 'vtt' | 'ass' | 'sbv' | 'txt';
