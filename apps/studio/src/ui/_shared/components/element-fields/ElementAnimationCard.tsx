import { memo, type ReactNode } from 'react';

interface ElementAnimationCardProps {
  label: string;
  selected: boolean;
  /** What it is drawn as, sized to the card by its own markup. */
  icon: ReactNode;
  onSelect: () => void;
}

const CARD_CLASS =
  'group flex flex-col items-stretch gap-1.5 p-2 rounded-sm border bg-surface-2 cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';
const CARD_AT_REST = 'border-edge-subtle text-fg-muted hover:border-edge-medium hover:text-fg-secondary';
const CARD_SELECTED = 'border-accent bg-accent/10 text-accent';

const ICON_CLASS = 'flex items-center justify-center h-10';
const LABEL_CLASS = 'text-3xs leading-none text-center truncate';

/**
 * One answer in the animation picker, drawn as what it does.
 *
 * A picture rather than a preview. What the library animates is written
 * in `em` against caption text, so an entrance played at the size of a
 * card travels a pixel or two and shows nothing — measured, over the
 * whole catalogue. Seeing the motion itself is a question for the
 * element on screen, not for a thumbnail — which the chosen card says
 * on hover, since nothing else offers to play it again.
 */
export const ElementAnimationCard = memo(function ElementAnimationCard({
  label,
  selected,
  icon,
  onSelect,
}: ElementAnimationCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={selected ? 'Play again' : undefined}
      className={`${CARD_CLASS} ${selected ? CARD_SELECTED : CARD_AT_REST}`}
      onClick={onSelect}
    >
      <span className={ICON_CLASS} aria-hidden>{icon}</span>
      <span className={LABEL_CLASS}>{label}</span>
    </button>
  );
});
