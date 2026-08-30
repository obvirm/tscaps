/**
 * How much video the detector takes on at a time.
 *
 * One number does three jobs, because they are the same job. It is the
 * chunk the background pass works through, so it bounds how long a
 * newly urgent stretch waits behind the chunk already running. It is
 * the stretch measured around a seek, reaching both ways because
 * someone who jumps to a point may then move either way from it. And
 * it is the head start taken before the editor is handed back, since
 * that head start is just the first chunk.
 *
 * Measured runs land between 0.2x and 0.4x real time, so a chunk costs
 * roughly a quarter to a half of its own length in wall clock. That is
 * the trade the value expresses: how long someone waits before the
 * editor opens, against how often playback runs into a stretch nobody
 * has measured.
 */
export class PersonSegmentationPacing {
  static readonly ANALYSIS_CHUNK_SEC = 14;
}
