import { useState } from 'react';
import type { TimelineDetail } from '@core/timeline/domain/TimelineDetail';
import type { TimelineDetailVisibility } from '@presentation/timeline/controllers/TimelineVisibilityController';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { VisibilityMenuButton } from '@ui/pages/editor/features/timeline/components/VisibilityMenuButton';
import { VisibilityMenuScreen } from '@ui/pages/editor/features/timeline/components/VisibilityMenuScreen';

interface VisibilityMenuPopoverProps {
  visible: TimelineDetailVisibility;
  onToggle: (detail: TimelineDetail) => void;
}

/** What the timeline shows, behind one trigger. */
export function VisibilityMenuPopover({ visible, onToggle }: VisibilityMenuPopoverProps) {
  const [isOpen, setOpen] = useState(false);
  return (
    <Popover
      open={isOpen}
      onOpenChange={setOpen}
      align="start"
      trigger={<VisibilityMenuButton />}
      screens={{ menu: <VisibilityMenuScreen visible={visible} onToggle={onToggle} /> }}
    />
  );
}
