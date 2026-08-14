import { Minus, Plus } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const GROUP_CLASS = 'inline-flex items-center';

const STEP_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer '
  + 'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 '
  + 'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 '
  + 'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

// Fixed width and tabular figures: the readout runs from 50% to several
// hundred, and letting it size itself would shuffle the two buttons
// sideways on every press.
const READOUT_BTN =
  'w-11 h-7 shrink-0 text-2xs tabular-nums rounded-xs bg-transparent border-none cursor-pointer '
  + 'text-fg-muted hover:text-fg-primary hover:bg-surface-2 '
  + 'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 '
  + 'disabled:hover:bg-transparent disabled:cursor-default';

interface ZoomStepperProps {
  /** 100 is the scale the document opened at. */
  zoomPercent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canReset: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

/**
 * Widens or narrows how much of the video a row covers, with the current
 * scale between the two presses.
 *
 * Zooming in draws the same seconds larger, which is what makes a short
 * word readable and what lets a dragged edge be placed near a landmark
 * without the snap taking it — the snap reaches a fixed number of
 * pixels, so it covers less time the closer the reader gets.
 *
 * The readout is the reset. It reads against the scale the document
 * opened at rather than against any absolute, because that scale is
 * itself derived from how fast the speaker talks: 100% is "as this
 * transcript was meant to be read", which is the only landmark here
 * worth going back to.
 */
export function ZoomStepper({
  zoomPercent,
  canZoomIn,
  canZoomOut,
  canReset,
  onZoomIn,
  onZoomOut,
  onReset,
}: ZoomStepperProps) {
  return (
    <div className={GROUP_CLASS}>
      <Tooltip text="Zoom out" position="bottom">
        <button
          type="button"
          className={STEP_BTN}
          onClick={onZoomOut}
          disabled={!canZoomOut}
          aria-label="Zoom out"
        >
          <Minus size={14} />
        </button>
      </Tooltip>
      <Tooltip text={canReset ? 'Back to the opening scale' : 'Opening scale'} position="bottom">
        <button
          type="button"
          className={READOUT_BTN}
          onClick={onReset}
          disabled={!canReset}
          aria-label={`Zoom ${zoomPercent}%. Back to the opening scale`}
        >
          {zoomPercent}%
        </button>
      </Tooltip>
      <Tooltip text="Zoom in" position="bottom">
        <button
          type="button"
          className={STEP_BTN}
          onClick={onZoomIn}
          disabled={!canZoomIn}
          aria-label="Zoom in"
        >
          <Plus size={14} />
        </button>
      </Tooltip>
    </div>
  );
}
