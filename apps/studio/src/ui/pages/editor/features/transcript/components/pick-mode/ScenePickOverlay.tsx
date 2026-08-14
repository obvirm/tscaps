interface ScenePickOverlayProps {
  /** Scene is part of the committed selection right now. */
  selected: boolean;
  /** Scene would be added to the selection on click; ignored when `selected` is true. */
  preview: boolean;
  accentColor: string;
  onClick: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}

const OVERLAY_CLASS =
  'absolute inset-0 cursor-pointer rounded-sm ' +
  'transition-[background-color,box-shadow] duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

/**
 * Transparent overlay that turns each scene into a click target
 * during pick mode. Intercepts pointer events on the underlying
 * SceneCard so inner controls stay quiet, and tints with the pick
 * session's accent color in one of two intensities: strong for
 * committed scenes, light for scenes that would be added if the user
 * commits the current hover.
 */
export function ScenePickOverlay({ selected, preview, accentColor, onClick, onHoverEnter, onHoverLeave }: ScenePickOverlayProps) {
  return (
    <div
      role="button"
      tabIndex={-1}
      className={OVERLAY_CLASS}
      style={{
        background: backgroundColor(selected, preview, accentColor),
        boxShadow: selected ? `inset 0 0 0 1px ${accentColor}` : undefined,
      }}
      onClick={onClick}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    />
  );
}

function backgroundColor(selected: boolean, preview: boolean, accentColor: string): string {
  if (selected) return `${accentColor}40`;
  if (preview) return `${accentColor}1F`;
  return 'transparent';
}
