import { afterEach, describe, expect, it, vi } from 'vitest';
import { Document, Section, type Transcriber, type TranscriberOptions } from '@tscaps/engine';
import {
  TranscriberWorkerHost,
  type TranscriberWorkerInbound,
  type TranscriberWorkerOutbound,
} from '@core/transcription/infrastructure/workers/TranscriberWorkerHost';

/**
 * What the host promises the transcriber it drives: the audio it hands
 * over is the audio the request described, and nothing more.
 *
 * The decoder on the other side of the message pre-sizes its buffer
 * from an estimated duration and fills only part of it. The slack past
 * what it wrote is digital silence — the surest way to make Whisper
 * invent words at the end of a clip — so the request carries the range
 * that was actually written and the host must honour it.
 */

class RecordingTranscriber implements Transcriber {
  receivedSamples: Float32Array | null = null;

  async transcribe(audio: Blob, _options?: TranscriberOptions): Promise<Document> {
    this.receivedSamples = new Float32Array(await audio.arrayBuffer());
    return new Document({ sections: [new Section({ segments: [], kind: '' })] });
  }
}

class WorkerScope extends EventTarget {
  readonly posted: TranscriberWorkerOutbound[] = [];

  postMessage(message: TranscriberWorkerOutbound): void {
    this.posted.push(message);
  }
}

const WRITTEN_SAMPLES = 6;
const BUFFER_SAMPLES = 10;

function requestWithSlack(): TranscriberWorkerInbound {
  const pcm = new Float32Array(BUFFER_SAMPLES);
  pcm.fill(0.5, 0, WRITTEN_SAMPLES);
  return {
    type: 'transcribe',
    audio: pcm.buffer,
    audioByteOffset: 0,
    audioSampleCount: WRITTEN_SAMPLES,
  };
}

async function runRequest(request: TranscriberWorkerInbound): Promise<RecordingTranscriber> {
  const scope = new WorkerScope();
  vi.stubGlobal('self', scope);
  const transcriber = new RecordingTranscriber();
  new TranscriberWorkerHost(() => transcriber).start();

  scope.dispatchEvent(new MessageEvent('message', { data: request }));
  await vi.waitFor(() => expect(scope.posted).not.toHaveLength(0));

  return transcriber;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('TranscriberWorkerHost', () => {
  it('hands the transcriber only the samples the request declared', async () => {
    const transcriber = await runRequest(requestWithSlack());

    expect(transcriber.receivedSamples).toHaveLength(WRITTEN_SAMPLES);
    expect([...transcriber.receivedSamples!]).toEqual(Array(WRITTEN_SAMPLES).fill(0.5));
  });
});
