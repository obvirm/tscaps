import { Loader2 } from 'lucide-react';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { useBehindActorAnalysisBlocked } from '@ui/pages/editor/features/person-segmentation/hooks/useBehindActorAnalysisBlocked';

const VEIL =
  'absolute inset-0 z-20 flex items-center justify-center ' +
  'backdrop-blur-md bg-surface-0/45 ' +
  'animate-fade-in cursor-default';

/**
 * Covers the preview while the moment on screen is one the detector
 * has not measured yet.
 *
 * The blur is the point, not decoration: an unmeasured frame is not a
 * finished one, and showing it sharp invites it to be read as the
 * final look — which it may not be, since the effect can still lift
 * the caption once the measurement lands. Veiling it says "not yet"
 * where an un-lifted caption would have said "no".
 *
 * It also swallows pointer events, so a click meant for play does not
 * reach the video underneath while it is being held. Only pointer
 * events: the veil is a status readout rather than a control, so it
 * takes no focus and leaves the timeline and the transcript reachable
 * — someone who does not want to wait here can always move somewhere
 * else.
 */
export function BehindActorAnalysisOverlay() {
  const blocked = useBehindActorAnalysisBlocked();
  if (!blocked) return null;
  return (
    <div className={VEIL} aria-hidden onPointerDown={(event) => event.stopPropagation()}>
      <StatusPill
        label="Applying text behind person"
        tone="info"
        icon={<Loader2 size={12} className="animate-spin" />}
      />
    </div>
  );
}
