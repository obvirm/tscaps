import type {
  ClientToWorkerMessage,
  WorkerToClientMessage,
} from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerProtocol';
import { DecodeWorkerServer } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerServer';
import { WorkerUncaughtErrorForwarder } from '@core/_shared/workers/WorkerUncaughtErrorForwarder';

new WorkerUncaughtErrorForwarder('decode-worker').install();

const server = new DecodeWorkerServer({
  respond(message: WorkerToClientMessage, transferables?: Transferable[]): void {
    if (transferables && transferables.length > 0) {
      self.postMessage(message, { transfer: transferables });
    } else {
      self.postMessage(message);
    }
  },
});

self.onmessage = (event: MessageEvent<ClientToWorkerMessage>): void => {
  server.handle(event.data);
};
