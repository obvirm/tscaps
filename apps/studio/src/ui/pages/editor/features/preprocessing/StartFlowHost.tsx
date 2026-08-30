import { useEffect, useMemo, useState } from 'react';
import type { PreprocessingFlowStore } from '@core/preprocessing/store/PreprocessingFlowStore';
import type { VideoValidationStatus } from '@core/preprocessing/domain/VideoValidationStatus';
import type { VideoValidator } from '@core/preprocessing/services/VideoValidator';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useTranscription } from '@ui/_shared/contexts/modules/TranscriptionContext';
import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { WHISPER_SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/transcription-languages';
import { StartDialog } from '@ui/pages/editor/features/preprocessing/StartDialog';
import { UnreadableVideoNotice } from '@ui/pages/editor/features/preprocessing/components/UnreadableVideoNotice';
import { NoAudioTrackNotice } from '@ui/pages/editor/features/preprocessing/components/NoAudioTrackNotice';
import { LongVideoWarning } from '@ui/pages/editor/features/preprocessing/components/LongVideoWarning';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

interface StartFlowHostProps {
  onBack: () => void;
}


function useDialogOpen(flow: PreprocessingFlowStore): boolean {
  const [open, setOpen] = useState<boolean>(() => flow.dialogOpen);
  useEffect(() => {
    const update = () => setOpen(flow.dialogOpen);
    flow.addEventListener('change', update);
    update();
    return () => flow.removeEventListener('change', update);
  }, [flow]);
  return open;
}

function useVideoValidationStatus(validator: VideoValidator): VideoValidationStatus {
  const [status, setStatus] = useState<VideoValidationStatus>(() => validator.status());
  useEffect(() => {
    const update = () => setStatus(validator.status());
    validator.addEventListener('change', update);
    update();
    return () => validator.removeEventListener('change', update);
  }, [validator]);
  return status;
}

/**
 * Hosts the start-video dialog. Listens to the derived `dialogOpen`
 * flag and mounts the dialog only while it is true. Cancel composes
 * "clear the loaded video" with the navigation callback supplied by
 * the route so the user lands back where the flow started.
 */
export function StartFlowHost({ onBack }: StartFlowHostProps) {
  const editor = useEditor();
  const transcription = useTranscription();
  const preprocessing = usePreprocessing();
  const { userAgentInspector } = useUtils();
  const open = useDialogOpen(preprocessing.flow);
  const state = useEditorState();
  const validation = useVideoValidationStatus(preprocessing.videoValidator);
  const languagesBase = WHISPER_SUPPORTED_LANGUAGES;
  const ranked = useMemo(
    () => preprocessing.languageRanker.rank(languagesBase),
    [preprocessing.languageRanker, languagesBase],
  );

  if (!open) return null;

  const handleCancel = () => {
    editor.actions.video.clear.execute();
    onBack();
  };

  const isUnreadable = validation.state === 'rejected' && validation.details.type === 'unreadable';
  const isAnalyzing = validation.state === 'analyzing';
  const startDisabled = validation.state !== 'accepted';
  const isMobile = userAgentInspector.isMobile();
  const videoDurationSeconds = state.video.duration;
  const recordLanguagePick = (language: SupportedLanguage) =>
    preprocessing.languageUsageRepository.recordPick(language);

  const validationNotices = (
    <>
      {isAnalyzing && (
        <p className="text-xs text-fg-muted">Analyzing video…</p>
      )}
      {isUnreadable && <UnreadableVideoNotice />}
      {state.video.hasAudioTrack === false && <NoAudioTrackNotice />}
    </>
  );


  return (
    <StartDialog
      open
      preference={state.transcribePreference}
      isMobileDevice={userAgentInspector.isMobile()}
      error={state.error}
      preprocessVideo={preprocessing.actions.preprocessVideo}
      updatePreference={transcription.actions.updatePreference}
      onCancel={handleCancel}
      startDisabled={startDisabled}
      languages={ranked.languages}
      mostUsedCode={ranked.mostUsedCode}
      lastUsedCode={ranked.lastUsedCode}
      onLanguagePicked={recordLanguagePick}
      extraNotices={
        <>
          {validationNotices}
          <LongVideoWarning
            videoDurationSeconds={videoDurationSeconds}
            isMobile={isMobile}
          />
        </>
      }
    />
  );
}

