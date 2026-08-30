import {
  Document,
  Line,
  NarrationPace,
  Section,
  Segment,
  TimeFragment,
  Word,
  type TranscriberOptions,
  type UntranscribedRegion,
} from '@tscaps/engine';
import { MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import { UNTRANSCRIBED_PLACEHOLDER_TEXT } from '@core/transcription/domain/UntranscribedPlaceholder';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { UntranscribedRegionsStore } from '@core/transcription/store/UntranscribedRegionsStore';
import type { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Transcribes a video file into a `Document` whose words carry their
 * per-word timing. Configures the underlying transcriber from the
 * supplied preference, reports progress through
 * `PreprocessingProgressStore`, and publishes any regions the run left
 * untranscribed — with a placeholder word covering each in the
 * document — through `UntranscribedRegionsStore`. The result is
 * returned, not written to a store; the orchestrator that drives the
 * preprocessing pipeline decides what to do with it.
 *
 * Throws on failure after cancelling the progress reporter so the
 * caller can surface the error and reset its own state.
 */
export class TranscribeAction {
  constructor(
    private readonly transcriber: ConfigurableTranscriber,
    private readonly progress: PreprocessingProgressStore,
    private readonly overlapClamper: WordOverlapClamper,
    private readonly untranscribedRegionsStore: UntranscribedRegionsStore,
    private readonly telemetry: Telemetry,
  ) {}

  async execute(
    videoFile: File,
    preference: TranscribePreference,
    options?: TranscriberOptions,
    languageCode?: string | null,
  ): Promise<Document> {
    this.transcriber.setConfig({
      model: preference.model,
      device: preference.backend,
    });
    this.untranscribedRegionsStore.clear();
    const regions: UntranscribedRegion[] = [];
    this.transcriber.onUntranscribedRegion = (region) => regions.push(region);
    this.progress.start(this.transcriber.initialPhase);

    try {
      const transcribed = await this.transcriber.transcribe(videoFile, options);
      const document = this.assemble(transcribed.getWords(), regions, languageCode ?? null);
      if (regions.length > 0) {
        this.untranscribedRegionsStore.publish(regions, preference.model);
        this.telemetry.capture('transcription_gaps_detected', {
          regions_count: regions.length,
          untranscribed_seconds: Math.round(
            regions.reduce((total, region) => total + (region.endSeconds - region.startSeconds), 0),
          ),
          model: preference.model,
          backend: preference.backend,
        });
      }
      return document;
    } catch (err) {
      this.progress.cancel();
      throw err;
    }
  }

  private assemble(
    rawWords: ReadonlyArray<Word>,
    untranscribedRegions: ReadonlyArray<UntranscribedRegion>,
    languageCode: string | null,
  ): Document {
    const allWords = this.overlapClamper.clamp(this.withPlaceholders(rawWords, untranscribedRegions));
    const segments = allWords.length === 0
      ? []
      : [new Segment({ lines: [new Line({ words: allWords })] })];
    return new Document({
      sections: [new Section({ segments, kind: MAIN_SHEET_ID })],
      narrationPace: NarrationPace.fromWords(allWords),
      language: languageCode,
    });
  }

  /**
   * Covers each untranscribed region with one placeholder word spanning
   * it, merged into time order. The placeholder is an ordinary word —
   * editable and deletable like any other.
   */
  private withPlaceholders(
    words: ReadonlyArray<Word>,
    regions: ReadonlyArray<UntranscribedRegion>,
  ): ReadonlyArray<Word> {
    if (regions.length === 0) return words;
    const placeholders = regions.map((region) => new Word({
      text: UNTRANSCRIBED_PLACEHOLDER_TEXT,
      time: new TimeFragment(region.startSeconds, region.endSeconds),
    }));
    return [...words, ...placeholders].sort((a, b) => a.time.start - b.time.start);
  }
}
