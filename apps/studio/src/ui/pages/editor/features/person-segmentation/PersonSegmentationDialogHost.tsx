import { useCallback, useEffect, useState } from 'react';
import type { StartBehindActorAnalysisAction } from '@core/person-segmentation/actions/StartBehindActorAnalysisAction';
import type { CancelPersonSegmentationAction } from '@core/person-segmentation/actions/CancelPersonSegmentationAction';
import type { PersonSegmentationFlowStore, PersonSegmentationFlowStatus } from '@core/person-segmentation/store/PersonSegmentationFlowStore';
import type { PersonSegmentationProgressStore, PersonSegmentationProgressStatus } from '@core/person-segmentation/store/PersonSegmentationProgressStore';
import type { PersonSegmentationTriggerAutomation } from '@core/person-segmentation/automations/PersonSegmentationTriggerAutomation';
import { PersonSegmentationDialog } from '@ui/pages/editor/features/person-segmentation/PersonSegmentationDialog';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

function useFlowStatus(flow: PersonSegmentationFlowStore): PersonSegmentationFlowStatus {
  const [status, setStatus] = useState<PersonSegmentationFlowStatus>(() => flow.status);
  useEffect(() => {
    const update = (): void => setStatus(flow.status);
    flow.addEventListener('change', update);
    update();
    return () => flow.removeEventListener('change', update);
  }, [flow]);
  return status;
}

function useProgressStatus(progress: PersonSegmentationProgressStore): PersonSegmentationProgressStatus {
  const [status, setStatus] = useState<PersonSegmentationProgressStatus>(() => progress.status);
  useEffect(() => {
    const update = (): void => setStatus(progress.status);
    progress.addEventListener('change', update);
    update();
    return () => progress.removeEventListener('change', update);
  }, [progress]);
  return status;
}

async function runAnalysis(
  flow: PersonSegmentationFlowStore,
  startAnalysis: StartBehindActorAnalysisAction,
  onSuccess: () => void,
): Promise<void> {
  flow.startRunning();
  try {
    await startAnalysis.execute();
    flow.finishRunning();
    onSuccess();
  } catch (error) {
    if (isAbortError(error)) {
      flow.close();
      return;
    }
    flow.failRunning(errorMessageOf(error));
  }
}

function handleCancel(
  flow: PersonSegmentationFlowStore,
  cancel: CancelPersonSegmentationAction,
  triggerAutomation: PersonSegmentationTriggerAutomation,
  currentMode: PersonSegmentationFlowStatus['mode'],
): void {
  if (currentMode === 'running') cancel.execute();
  triggerAutomation.revertPending();
  flow.close();
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;
  return 'Something went wrong while scanning. Please try again.';
}

/**
 * Mounts the prepare-video dialog while the flow store is open. Cancel
 * from any mode reverts a pending template swap through the trigger
 * automation; success drops the pending revert.
 *
 * Nothing is reported when it closes. The dialog now waits only for a
 * head start, so any count of matching scenes it could give would be
 * a count for the first few seconds — read as a verdict on the video,
 * it would be wrong, and it would go on being wrong as the background
 * pass found more.
 */
export function PersonSegmentationDialogHost() {
  const personSegmentation = usePersonSegmentation();
  const { flowStore, progressStore, actions, triggerAutomation } = personSegmentation;
  const flowStatus = useFlowStatus(flowStore);
  const progressStatus = useProgressStatus(progressStore);
  const onSuccess = useCallback(() => triggerAutomation.noteAcceptance(), [triggerAutomation]);

  if (flowStatus.mode === 'closed') return null;
  return (
    <PersonSegmentationDialog
      mode={flowStatus.mode}
      error={flowStatus.error}
      phase={progressStatus.phase}
      fraction={progressStatus.fraction}
      onContinue={() => runAnalysis(flowStore, actions.startAnalysis, onSuccess)}
      onRetry={() => runAnalysis(flowStore, actions.startAnalysis, onSuccess)}
      onCancel={() => handleCancel(flowStore, actions.cancel, triggerAutomation, flowStatus.mode)}
    />
  );
}
