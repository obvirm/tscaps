import type { ReactElement } from 'react';
import type { AppError } from '@core/errors/domain/AppError';
import type { FailureReason } from '@core/errors/domain/FailureReason';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { useErrors } from '@ui/_shared/contexts/modules/ErrorsContext';
import type { UnsupportedAudioCodecError } from '@core/videos/domain/errors/UnsupportedAudioCodecError';
import type { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';

const SUPPORT_EMAIL = 'support@tscaps.io';

/**
 * What actually frees space, in the order most likely to work. The
 * browser refuses the write long before the disk is literally full,
 * so "delete something" is not enough on its own.
 */
const STORAGE_RECOVERY_BULLETS: readonly string[] = [
  'Free up disk space on your device, then reload the page.',
  'If you are in a private or incognito window, open tscaps in a regular one. Private windows get a much smaller storage allowance.',
  'Clear site data for sites you no longer use.',
];

interface AppErrorMessageProps {
  readonly error: AppError;
  readonly isMobile?: boolean;
}

/**
 * Returns a short, surface-agnostic title describing the failure
 * mode of an `AppError`. Suitable for the header of a dialog or
 * the heading of an inline banner. Unknown error names collapse to
 * a generic title so the UI never goes blank.
 */
export function getAppErrorTitle(error: AppError): string {
  switch (error.name) {
    case 'UnknownAppError':                  return 'Something went wrong';
    case 'ProjectSaveFailedError':           return "Couldn't save your project";
    case 'ExportFailedError':                return "Export didn't finish";
    case 'ProjectListLoadFailedError':       return "Couldn't load your projects";
    case 'ProjectDeleteFailedError':         return "Couldn't delete this project";
    case 'ProjectExportFailedError':         return "Couldn't export this project";
    case 'ProjectImportFailedError':         return "Couldn't import this project";
    case 'AudioExtractionFailedError':       return "Couldn't read this video's audio";
    case 'LocalTranscriptionFailedError':    return "On-device transcription didn't finish";
    case 'TranscriptionModelCacheFailedError': return "Couldn't save Whisper transcription model";
    case 'PreviewProxyGenerationFailedError': return "Preview isn't optimized";
    case 'PreviewLoadFailedError':           return "Couldn't load this video's preview";
    case 'UnsupportedVideoCodecError':       return "This video can't play in your browser";
    case 'UnsupportedAudioCodecError':       return "This video's audio can't play in your browser";
    case 'VideoDurationUnreadableError':     return "We couldn't read this video's length";
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

/**
 * Names the condition behind a failure so copy can refine on it.
 *
 * An error's name says which operation failed; this says what stopped
 * it. Most entries below need only the first and ignore the result.
 */
function useFailureReason(error: AppError): FailureReason {
  const { failureReasonResolver } = useErrors();
  return failureReasonResolver.resolve(error);
}

/**
 * One-line description of an `AppError` for space-constrained
 * surfaces (toasts, chips, tooltips). Full remediation guidance
 * lives in {@link AppErrorMessage}; this hook hands back a plain
 * string so it can sit inside a single line of chrome.
 */
export function useAppErrorShortDescription(error: AppError): string {
  const reason = useFailureReason(error);
  switch (error.name) {
    case 'UnknownAppError':                  return 'Try the action again.';
    case 'ProjectSaveFailedError':           return describeSaveFailure(reason);
    case 'ExportFailedError':                return 'The export was interrupted before it finished.';
    case 'ProjectListLoadFailedError':       return 'Check your internet connection.';
    case 'ProjectDeleteFailedError':         return 'Check your internet connection.';
    case 'ProjectExportFailedError':         return "Something went wrong while packaging your project.";
    case 'ProjectImportFailedError':         return "The file couldn't be read as a tscaps export.";
    case 'AudioExtractionFailedError':       return describeAudioExtractionFailure(reason);
    case 'LocalTranscriptionFailedError':    return describeLocalTranscriptionFailure(reason);
    case 'TranscriptionModelCacheFailedError': return describeModelCacheFailure(reason);
    case 'PreviewProxyGenerationFailedError': return describeProxyFailure(reason);
    case 'PreviewLoadFailedError':           return "The video couldn't be loaded into the editor.";
    case 'UnsupportedVideoCodecError':       return "Your browser can't decode this video's format.";
    case 'UnsupportedAudioCodecError':       return "Your browser can't decode this video's audio.";
    case 'VideoDurationUnreadableError':     return 'Playback and scrubbing may be limited. Re-importing the file usually fixes it.';
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

/**
 * Each describer enumerates only the reasons that can meaningfully
 * arise for the operation it names, and falls back to the generic copy
 * for everything else. Exhaustiveness on the full `FailureReason` union
 * would force every describer to spell out every reason — including
 * combinations that are unreachable (a transcription-backend condition
 * cannot cause a save or a proxy failure) — and drown the useful
 * branches in dead ones every time the union grows.
 */
function describeSaveFailure(reason: FailureReason): string {
  switch (reason) {
    case 'storage-full': return 'Your device is out of space. Free some up, then save again.';
    default:             return 'Your work is still open in the editor. Try saving again.';
  }
}

function describeProxyFailure(reason: FailureReason): string {
  switch (reason) {
    case 'storage-full':      return 'Playback may be slower than usual. Free up disk space to restore it.';
    case 'codec-unsupported': return "Your browser can't process this video's format. Playback may be slower than usual.";
    default:                  return 'Playback may be slower than usual. Your captions and export are unaffected.';
  }
}

function describeAudioExtractionFailure(reason: FailureReason): string {
  switch (reason) {
    case 'codec-unsupported': return "Your browser can't process this video's audio format.";
    default:                  return "We couldn't read the audio from this video.";
  }
}

function describeModelCacheFailure(reason: FailureReason): string {
  switch (reason) {
    case 'storage-full': return 'Your device is out of space, so your next video will download it again.';
    default:             return 'Your next video will download it again.';
  }
}

function describeLocalTranscriptionFailure(reason: FailureReason): string {
  switch (reason) {
    case 'backend-unavailable': return "The transcribe backend you picked isn't usable on this device. Switch it in Advanced settings.";
    default:                    return "On-device transcription couldn't finish.";
  }
}

/**
 * Whether a notice about this error has to wait for the reader to
 * dismiss it.
 *
 * Nothing in the app keeps a history of notices, so one that times
 * out unread is unrecoverable: whoever stepped away can never find
 * out why something now behaves differently. Waiting is therefore
 * the default, and fading away is what needs justifying — it fits
 * only a failure whose whole consequence is already plain on screen.
 */
export function requiresManualDismissal(error: AppError): boolean {
  return error.name !== 'PreviewProxyGenerationFailedError';
}

/**
 * Renders the body text for an `AppError` — what happened, what the
 * user can try, and how to reach support. The title is intentionally
 * not included; surfaces compose it via `getAppErrorTitle` so they
 * can place it in their own header style.
 */
export function AppErrorMessage({ error, isMobile = false }: AppErrorMessageProps): ReactElement {
  const reason = useFailureReason(error);
  switch (error.name) {
    case 'UnknownAppError':                  return <GenericFailureBody isMobile={isMobile} />;
    case 'ProjectSaveFailedError':           return <ProjectSaveFailedBody reason={reason} />;
    case 'ExportFailedError':                return <ExportFailedBody isMobile={isMobile} />;
    case 'ProjectListLoadFailedError':       return <ProjectListLoadFailedBody />;
    case 'ProjectDeleteFailedError':         return <ProjectDeleteFailedBody />;
    case 'ProjectExportFailedError':         return <ProjectExportFailedBody />;
    case 'ProjectImportFailedError':         return <ProjectImportFailedBody />;
    case 'AudioExtractionFailedError':       return <AudioExtractionFailedBody reason={reason} isMobile={isMobile} />;
    case 'LocalTranscriptionFailedError':    return <LocalTranscriptionFailedBody reason={reason} isMobile={isMobile} />;
    case 'TranscriptionModelCacheFailedError': return <TranscriptionModelCacheFailedBody reason={reason} />;
    case 'PreviewProxyGenerationFailedError': return <PreviewProxyGenerationFailedBody reason={reason} isMobile={isMobile} />;
    case 'PreviewLoadFailedError':           return <PreviewLoadFailedBody isMobile={isMobile} />;
    case 'UnsupportedVideoCodecError':       return <UnsupportedVideoCodecBody error={error as UnsupportedVideoCodecError} isMobile={isMobile} />;
    case 'UnsupportedAudioCodecError':       return <UnsupportedAudioCodecBody error={error as UnsupportedAudioCodecError} isMobile={isMobile} />;
    case 'VideoDurationUnreadableError':     return <VideoDurationUnreadableBody />;
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

function PreviewProxyGenerationFailedBody({
  reason,
  isMobile,
}: {
  readonly reason: FailureReason;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  const lead = "We couldn't build a lightweight version of this video for the editor, so playback runs on the original and may be slower. Your captions and your export are unaffected. A few things you can try:";
  if (reason === 'storage-full') {
    return <ErrorBody lead={lead} bullets={STORAGE_RECOVERY_BULLETS} />;
  }
  return (
    <ErrorBody
      lead={lead}
      bullets={[
        'Reload the page to let the editor try again.',
        'Convert the video to MP4 (H.264) and import it again.',
        ...fallbackBullets,
      ]}
    />
  );
}

function PreviewLoadFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="We couldn't load this video into the editor. A few things you can try:"
      bullets={['Upload the video again in a new project.', ...fallbackBullets]}
    />
  );
}

function UnsupportedVideoCodecBody({
  error,
  isMobile,
}: {
  readonly error: UnsupportedVideoCodecError;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="Your browser doesn't support this video's format. A few things you can try:"
      bullets={['Convert the video to MP4 (H.264) and upload it again.', ...fallbackBullets]}
      details={`Source codec: ${error.codec}`}
    />
  );
}

function UnsupportedAudioCodecBody({
  error,
  isMobile,
}: {
  readonly error: UnsupportedAudioCodecError;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="Your browser can't process this video's audio. A few things you can try:"
      bullets={['Convert the audio to AAC or Opus and upload again.', ...fallbackBullets]}
      details={`Source codec: ${error.codec}`}
    />
  );
}

function AudioExtractionFailedBody({
  reason,
  isMobile,
}: {
  readonly reason: FailureReason;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  if (reason === 'codec-unsupported') {
    return (
      <ErrorBody
        lead="Your browser couldn't decode the audio of this video. A few things you can try:"
        bullets={[
          'Convert the video to MP4 with H.264 video and AAC audio, then upload it again.',
          ...fallbackBullets,
        ]}
      />
    );
  }
  return (
    <ErrorBody
      lead="We weren't able to read the audio from this video. A few things you can try:"
      bullets={['Upload a different video.', ...fallbackBullets]}
    />
  );
}

function VideoDurationUnreadableBody(): ReactElement {
  return (
    <ErrorBody
      lead="Playback and scrubbing may be limited because we couldn't read the video's length."
      bullets={[
        'Re-import the file. That usually recovers the length.',
        'Convert the video to MP4 (H.264) and try again.',
      ]}
    />
  );
}


function ProjectSaveFailedBody({ reason }: { readonly reason: FailureReason }): ReactElement {
  if (reason === 'storage-full') {
    return (
      <ErrorBody
        lead="Your device is out of space, so your changes could not be written. Your work is still open in the editor. A few things you can try:"
        bullets={STORAGE_RECOVERY_BULLETS}
      />
    );
  }
  return (
    <ErrorBody
      lead="We weren't able to save your changes. Your work is still open in the editor."
      bullets={['Try saving again.', 'If it keeps failing, check your internet connection.']}
    />
  );
}

function ExportFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="Something went wrong while burning the subtitles into your video. A few things you can try:"
      bullets={useEngineFallbackBullets(isMobile)}
    />
  );
}

function ProjectListLoadFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to load your projects."
      bullets={['Check your internet connection.']}
    />
  );
}

function ProjectDeleteFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to delete this project."
      bullets={['Check your internet connection.']}
    />
  );
}

function ProjectExportFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to package this project for export."
      bullets={[]}
    />
  );
}

function ProjectImportFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to read this file."
      bullets={['Make sure the file is a valid .tscaps export.']}
    />
  );
}


function LocalTranscriptionFailedBody({ reason, isMobile }: { reason: FailureReason; isMobile: boolean }): ReactElement {
  return reason === 'backend-unavailable'
    ? <TranscriptionBackendUnavailableBody />
    : <GenericLocalTranscriptionFailedBody isMobile={isMobile} />;
}

function GenericLocalTranscriptionFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="In-browser transcription couldn't complete on your device. A few things you can try:"
      bullets={['Try a shorter video.', ...fallbackBullets]}
    />
  );
}

/**
 * The user picked a transcribe backend the current device can't run.
 * No engine-fallback bullets — the fix is inside the app, not in
 * switching browsers.
 */
function TranscriptionBackendUnavailableBody(): ReactElement {
  return (
    <ErrorBody
      lead="The transcribe backend you picked isn't usable on this device. A couple of things to try:"
      bullets={[
        'Open Advanced settings on the transcribe screen and switch the backend to CPU, then start again.',
        'If you picked GPU, WebGPU support depends on your OS, GPU, and browser build.',
      ]}
    />
  );
}

/**
 * The transcription itself went through, so the copy is about the next
 * run and nothing else. No engine-fallback bullets: the browser is not
 * what refused, its storage is, and a different browser on the same
 * full disk behaves the same way.
 */
function TranscriptionModelCacheFailedBody({ reason }: { readonly reason: FailureReason }): ReactElement {
  const lead = 'Transcribing on your device needs to download a model. Tscaps saves it so your next video can start right away, but this time something went wrong, so the next video will download it again. A few things you can try:';
  if (reason === 'storage-full') {
    return (
      <ErrorBody
        lead={lead}
        bullets={[
          'Free up disk space on your device.',
          'Clear site data for sites you no longer use.',
          'If you are in a private or incognito window, open tscaps in a normal one.',
        ]}
      />
    );
  }
  return (
    <ErrorBody
      lead={lead}
      bullets={[
        'If you are in a private or incognito window, open tscaps in a normal one. Private windows delete everything when you close them.',
        'Check whether your browser erases site data every time it closes. If it does, add an exception for tscaps.',
      ]}
    />
  );
}


function GenericFailureBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="An unexpected error happened. A few things you can try:"
      bullets={useEngineFallbackBullets(isMobile)}
    />
  );
}

/**
 * Bullets that point the user at a more capable browser engine.
 * Only relevant for failures whose root cause sits in the browser
 * runtime — codec / encoder / worker / WebGPU paths. Network,
 * storage, or server-side failures do not benefit from these hints
 * and must not include them. The Chromium suggestion is dropped when
 * the user is already on a Chromium-based browser — pointing them at
 * the browser they are in is a dead end.
 */
function useEngineFallbackBullets(isMobile: boolean): string[] {
  const browser = useUtils().userAgentInspector.getBrowser();
  const isChromiumBased = browser === 'chrome' || browser === 'edge' || browser === 'opera';
  const bullets: string[] = [];
  if (!isChromiumBased) {
    bullets.push(
      'Open tscaps in a Chromium-based browser (Chrome, Edge, Brave) — they have the broadest support for our pipeline.',
    );
  }
  if (isMobile) bullets.push("If you're on mobile, try from a desktop browser.");
  return bullets;
}

function ErrorBody({
  lead,
  bullets,
  details,
}: {
  readonly lead: string;
  readonly bullets: readonly string[];
  readonly details?: string;
}): ReactElement {
  return (
    <div className="space-y-2">
      <p className="m-0">{lead}</p>
      {bullets.length >= 2 && (
        <ul className="list-disc pl-5 m-0 space-y-1">
          {bullets.map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}
      {bullets.length === 1 && <p className="m-0">{bullets[0]}</p>}
      <p className="m-0">
        Still stuck? Email us at <SupportLink /> and we&apos;ll take a look.
      </p>
      {details && <p className="m-0 text-fg-faint text-xs">{details}</p>}
    </div>
  );
}

function SupportLink(): ReactElement {
  return (
    <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  );
}
