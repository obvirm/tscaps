import { memo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { AnimationSupport } from '@core/templates/domain/definition/FeaturesConfig';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { ANIMATION_SCOPE_LABELS, ELEMENT_KIND_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { ElementAnimationSection } from '@ui/pages/editor/features/element/ElementAnimationSection';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';

interface ElementMotionPanelProps {
  elementId: string;
  kind: ElementKind;
  /** Which kinds of element the sheet's template survives being animated, or `null` when it has no sheet. */
  animationSupport: AnimationSupport | null;
  style: ElementStyle | null;
  /** The stretch of video the element occupies, which is what a replay plays. */
  startsAt: number;
  endsAt: number;
  /** Plays one stretch of the video once, kept inside the scene however far it is asked to reach. */
  onReplay: (startSec: number, endSec: number) => void;
}

const STRIP_CLASS = 'flex gap-4 border-b border-edge-subtle mb-3';
// No focus ring. Radix moves focus onto the trigger it activates, so a
// plain click leaves one behind — and the tab a ring would point at is
// the one the accent underline already marks, since selection follows
// focus here.
const STRIP_TAB_CLASS =
  'relative pb-2 bg-transparent border-none cursor-pointer text-xs '
  + 'transition-colors duration-quick ease-standard outline-none '
  + 'text-fg-muted hover:text-fg-secondary '
  + 'data-[state=active]:text-accent '
  + 'after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-transparent '
  + 'data-[state=active]:after:bg-accent';

/**
 * How the element moves, one part of it at a time.
 *
 * An element that wraps words offers two, because "the caption slides
 * in" and "its words rise one by one" are different answers, and a user
 * who wants the second should not have to give it once per word nor
 * lose it the moment a word is added. They are read one at a time
 * rather than stacked: each is a full grid, and two of those is a page
 * of scrolling to compare answers that are never compared.
 *
 * An element with one part shows no strip at all — a choice of one is
 * not a choice, and naming it restates the header above it. The section
 * below carries a heading of its own in that case, and none where the
 * strip is already saying which part is open.
 */
export const ElementMotionPanel = memo(function ElementMotionPanel({
  elementId,
  kind,
  animationSupport,
  style,
  startsAt,
  endsAt,
  onReplay,
}: ElementMotionPanelProps) {
  const { styledElementCatalog, animationSupport: support } = useElements().services;
  const scopes = styledElementCatalog.animationScopesFor(kind);

  // Every kind moves itself, so falling back there is always an answer
  // the element offers — which matters when the picked part belongs to
  // the element that was open before this one.
  const [picked, setPicked] = useState<ElementAnimationScope>(ElementAnimationScope.SELF);
  const open = scopes.includes(picked) ? picked : ElementAnimationScope.SELF;

  return (
    <Tabs.Root value={open} onValueChange={(value) => setPicked(value as ElementAnimationScope)}>
      {scopes.length > 1 && (
        <Tabs.List className={STRIP_CLASS} aria-label="What moves">
          {scopes.map((scope) => (
            <Tabs.Trigger key={scope} value={scope} className={STRIP_TAB_CLASS}>
              {titleFor(scope, kind)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      )}
      {scopes.map((scope) => (
        <Tabs.Content key={scope} value={scope}>
          <ElementAnimationSection
            elementId={elementId}
            kind={kind}
            scope={scope}
            namedAbove={scopes.length > 1}
            supported={animationSupport === null || support.supports(animationSupport, scope, kind)}
            style={style}
            startsAt={startsAt}
            endsAt={endsAt}
            onReplay={onReplay}
          />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
});

/** What the part is called on screen: the element's own name, or the parts it holds. */
function titleFor(scope: ElementAnimationScope, kind: ElementKind): string {
  return ANIMATION_SCOPE_LABELS[scope] ?? ELEMENT_KIND_LABELS[kind];
}
