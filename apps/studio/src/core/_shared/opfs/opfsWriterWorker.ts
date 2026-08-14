import { OpfsWriterWorkerHost } from '@core/_shared/opfs/OpfsWriterWorkerHost';
import { WorkerUncaughtErrorForwarder } from '@core/_shared/workers/WorkerUncaughtErrorForwarder';

new WorkerUncaughtErrorForwarder('opfs-writer-worker').install();

new OpfsWriterWorkerHost().start();
