import { PersonSegmenterWorkerHost } from '@core/person-segmentation/infrastructure/workers/PersonSegmenterWorkerHost';
import { ModuleWorkerImportScriptsShim } from '@core/person-segmentation/infrastructure/workers/ModuleWorkerImportScriptsShim';
import { WorkerUncaughtErrorForwarder } from '@core/_shared/workers/WorkerUncaughtErrorForwarder';

new WorkerUncaughtErrorForwarder('person-segmenter-worker').install();

new ModuleWorkerImportScriptsShim().install();
new PersonSegmenterWorkerHost().start();
