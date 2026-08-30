import { TriangleAlert } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

const WARNING_TEXT =
  'Modern templates rely on AI semantic tags to shape each caption. '
  + 'The AI tagger isn\'t running, so they will look different than the preview.';

const TRIGGER_CLASS =
  'inline-flex items-center justify-center bg-transparent border-none p-0 rounded-xs cursor-help '
  + 'text-warning transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/30';

/**
 * Small warning affordance intended for a template gallery section
 * whose look depends on AI semantic tags. Hovering (or tapping on
 * touch) reveals why templates in that family show plainer than their
 * preview. Does not navigate.
 */
export function AiTagsMissingWarning() {
  return (
    <Tooltip text={WARNING_TEXT} tapToOpen>
      <button type="button" aria-label={WARNING_TEXT} className={TRIGGER_CLASS}>
        <TriangleAlert size={12} strokeWidth={2} aria-hidden />
      </button>
    </Tooltip>
  );
}
