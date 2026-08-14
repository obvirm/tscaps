import {
  WhisperTranscriber,
  PreDecodedAudioDecoder,
  CacheStorageModelFileCache,
  type WhisperTranscriberConfig,
} from '@tscaps/engine';
import { TranscriberWorkerHost } from '@core/transcription/infrastructure/workers/TranscriberWorkerHost';
import { WorkerUncaughtErrorForwarder } from '@core/_shared/workers/WorkerUncaughtErrorForwarder';

new WorkerUncaughtErrorForwarder('whisper-worker').install();

const host: TranscriberWorkerHost = new TranscriberWorkerHost(
  (config) => new WhisperTranscriber(
    new PreDecodedAudioDecoder(),
    config as WhisperTranscriberConfig | undefined,
    new CacheStorageModelFileCache((error) => host.reportAssetsNotKept(error)),
  ),
);
host.start();
