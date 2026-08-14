import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExportStore } from '@core/export/store/ExportStore';
import type { ExportRun } from '@core/export/domain/ExportRun';
import type { ExportNotice } from '@core/export/domain/ExportNotice';
import { ExportResolutionPresets } from '@presentation/export/services/ExportResolutionPresets';
import { FallbackDecoderAdvisor } from '@presentation/export/services/FallbackDecoderAdvisor';
import { ExportFlow } from '@ui/pages/editor/features/export/components/ExportFlow';
import type { FallbackDecoderWarning } from '@ui/pages/editor/features/export/components/ExportDialog';
import type { ExportVideoOptions } from '@core/export/actions/ExportVideoAction';
import type { ExportSubtitlesOptions } from '@core/export/actions/ExportSubtitlesAction';
import type { ResolutionView } from '@ui/pages/editor/features/export/components/VideoExportSettings';
import { useExport } from '@ui/_shared/contexts/modules/ExportContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

interface ExportFlowHostProps {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

interface ExportLifecycleSnapshot {
  readonly run: ExportRun | null;
  readonly notice: ExportNotice | null;
}

function useExportLifecycle(runStore: ExportStore): ExportLifecycleSnapshot {
  const [snapshot, setSnapshot] = useState<ExportLifecycleSnapshot>(() => ({
    run: runStore.run,
    notice: runStore.notice,
  }));
  useEffect(() => {
    const update = () => setSnapshot({ run: runStore.run, notice: runStore.notice });
    runStore.addEventListener('change', update);
    update();
    return () => runStore.removeEventListener('change', update);
  }, [runStore]);
  return snapshot;
}

/**
 * Hosts the export dialog. Subscribes to the export state store for
 * the run/notice lifecycle and to the editor state for the project
 * layout, thumbnail, and error message; derives the fallback-decoder
 * warning from the supplied advisor and environment when an export
 * pauses on that reason; and wires action instances to the dialog's
 * callbacks.
 *
 * Lives outside the editor surface so the dialog can mount both in the
 * normal editor branch (settings opened from the toolbar) and on top
 * of the exporting splash (pause / error / notice mid-export).
 */
export function ExportFlowHost({
  settingsOpen,
  onSettingsOpenChange,
}: ExportFlowHostProps) {
  const exports = useExport();
  const { userAgentInspector } = useUtils();
  const state = useEditorState();
  const { run, notice } = useExportLifecycle(exports.runStore);
  const extraNotice = null;
  const environment = useMemo(() => userAgentInspector.detect(), [userAgentInspector]);
  const resolutionPresets = useMemo(() => new ExportResolutionPresets(), []);
  const fallbackDecoderAdvisor = useMemo(() => new FallbackDecoderAdvisor(), []);

  const pause = run?.pause ?? null;
  const fallbackWarning = useMemo<FallbackDecoderWarning | null>(() => {
    if (!pause || pause.kind !== 'fallback-decoder') return null;
    const advice = fallbackDecoderAdvisor.adviseFor(pause.codec, environment);
    return {
      humanCodec: advice.humanCodec,
      humanBrowser: environment.humanBrowser,
      humanOs: environment.humanOs,
      reEncodeTo: advice.reEncodeTo,
      betterBrowser: advice.betterBrowser,
    };
  }, [pause, fallbackDecoderAdvisor, environment]);

  const videoLayout = state.video.layout;
  const resolutionView = useMemo<ResolutionView | null>(() => {
    if (!videoLayout) return null;
    return {
      catalog: resolutionPresets.forInput(videoLayout.width, videoLayout.height),
      verticalDownscaleApplied: resolutionPresets.isVerticalDownscaleDefault(videoLayout.width, videoLayout.height),
      sourceDescription: resolutionPresets.describe(videoLayout.width, videoLayout.height),
    };
  }, [resolutionPresets, videoLayout]);

  const handleExportVideo = useCallback((options: ExportVideoOptions): Promise<void> =>
    exports.actions.run.execute(options), [exports]);

  // A subtitle file is written in one turn and raises no run, so nothing
  // downstream will ever close the dialog for it.
  const handleExportSubtitles = useCallback((options: ExportSubtitlesOptions): void => {
    exports.actions.runSubtitles.execute(options);
    onSettingsOpenChange(false);
  }, [exports, onSettingsOpenChange]);

  return (
    <ExportFlow
      settingsOpen={settingsOpen}
      onSettingsOpenChange={onSettingsOpenChange}
      exportRun={run}
      exportError={state.error}
      exportNotice={notice}
      videoLayout={state.video.layout}
      extraNotice={extraNotice}
      fallbackWarning={fallbackWarning}
      resolutionView={resolutionView}
      onExportVideo={handleExportVideo}
      onExportSubtitles={handleExportSubtitles}
      onAcceptExportPause={() => exports.actions.acceptPause.execute()}
      onRejectExportPause={() => exports.actions.rejectPause.execute()}
      onDismissExportNotice={() => exports.actions.dismissNotice.execute()}
      userAgentInspector={userAgentInspector}
    />
  );
}
